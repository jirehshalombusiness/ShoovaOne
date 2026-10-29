"""Seed finance, payroll and supporting records for the launch demo.

Usage (from backend/):
    python scripts/sim_seed_finance_payroll.py

Creates:
  * Aug/Sep/Oct 2026 pay periods
  * six payroll runs (Leadership + Head Office x 3 months)
  * run items, lines, approvals, locked timesheets, payslips
  * statutory remittances, GL entries, disbursement batches
  * loan installments and pay adjustments
  * budgets, allocations, fund requests, expenses, reimbursements,
    invoices and payments
  * documents, devices, HR notes, compensation requests, chat,
    notifications and audit logs
"""
import asyncio
import datetime as dt
import hashlib
import json
import sys
import uuid
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import asyncpg

from app.core.config import settings

BASE = Path(__file__).resolve().parents[1]
LOOKUP = json.loads((BASE / "backups" / "sim_lookup.json").read_text(encoding="utf-8"))
WORK = json.loads((BASE / "backups" / "sim_work_lookup.json").read_text(encoding="utf-8"))

PEOPLE = {key: uuid.UUID(value) for key, value in LOOKUP["people"].items()}
USERS = {key: uuid.UUID(value) for key, value in LOOKUP["users"].items()}
DEPT = {key: uuid.UUID(value) for key, value in LOOKUP["departments"].items()}
ORG = uuid.UUID(LOOKUP["org"])
PROJECTS = {key: uuid.UUID(value) for key, value in WORK["projects"].items()}
PROGRAMMES = {key: uuid.UUID(value) for key, value in WORK["programmes"].items()}

ZERO = Decimal("0")
UTC = dt.timezone.utc
NOW = dt.datetime(2026, 10, 29, 18, 0, tzinfo=UTC)


def money(value) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def dec(value) -> Decimal:
    return Decimal(str(value))


def amt(value) -> Decimal:
    return Decimal(str(value).replace(",", ""))


def at(day: dt.date, hour: int, minute: int = 0) -> dt.datetime:
    return dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=UTC)


def month_end(year: int, month: int) -> dt.date:
    if month == 12:
        return dt.date(year, 12, 31)
    return dt.date(year, month + 1, 1) - dt.timedelta(days=1)


async def insert_many(conn, table, rows):
    if not rows:
        return
    columns = list(rows[0].keys())
    sql = (
        f'INSERT INTO "{table}" ({", ".join(columns)}) '
        f'VALUES ({", ".join(f"${i}" for i in range(1, len(columns) + 1))})'
    )
    await conn.executemany(sql, [tuple(row[c] for c in columns) for row in rows])


def progressive_tax(taxable: Decimal, bands) -> Decimal:
    if taxable <= ZERO:
        return ZERO
    tax = ZERO
    for lower, upper, rate in bands:
        if taxable <= lower:
            continue
        top = taxable if upper is None else min(upper, taxable)
        slice_ = top - lower
        if slice_ > ZERO:
            tax += slice_ * rate
    return money(tax)


async def seed_payroll(conn, staff, groups, staff_by_group, bands):
    periods = [
        ("August 2026", dt.date(2026, 8, 1), dt.date(2026, 8, 31), dt.date(2026, 8, 31), "closed"),
        ("September 2026", dt.date(2026, 9, 1), dt.date(2026, 9, 30), dt.date(2026, 9, 30), "closed"),
        ("October 2026", dt.date(2026, 10, 1), dt.date(2026, 10, 31), dt.date(2026, 10, 30), "open"),
    ]
    period_ids = {}
    period_rows = []
    for name, start, end, pay_date, status in periods:
        pid = uuid.uuid4()
        period_ids[name] = (pid, start, end, pay_date)
        period_rows.append(
            {
                "id": pid,
                "name": name,
                "frequency": "monthly",
                "period_start": start,
                "period_end": end,
                "cutoff_at": at(pay_date - dt.timedelta(days=4), 17),
                "pay_date": pay_date,
                "status": status,
                "notes": None,
                "created_at": at(start, 8),
                "updated_at": at(pay_date, 9),
            }
        )
    await insert_many(conn, "payroll_pay_periods", period_rows)

    approved_timesheets = await conn.fetch(
        "SELECT id, person_id, week_start_date, week_end_date, total_hours "
        "FROM timesheets WHERE status = 'approved'"
    )
    ts_by_person = {}
    for row in approved_timesheets:
        ts_by_person.setdefault(row["person_id"], []).append(row)

    run_status = {
        "2026-08": "paid",
        "2026-09": "paid",
        "2026-10": {"Leadership": "hr_approved", "Head Office": "calculated"},
    }

    run_rows, item_rows, line_rows = [], [], []
    approval_rows, ts_lock_rows, payslip_rows = [], [], []
    remit_rows, gl_rows, batch_rows, batch_item_rows = [], [], [], []
    adjustments = []
    ytd = {person["id"]: [ZERO, ZERO, ZERO] for person in staff}

    run_sequence = 0
    for name, start, end, pay_date, _status in periods:
        period_id = period_ids[name][0]
        month_key = start.strftime("%Y-%m")
        for group in ("Leadership", "Head Office"):
            status = run_status[month_key]
            if isinstance(status, dict):
                status = status[group]
            run_sequence += 1
            run_id = uuid.uuid4()
            run_number = f"PR-{month_key}-{'LEAD' if group == 'Leadership' else 'HO'}"

            members = staff_by_group[group]
            gross_total = ZERO
            employee_total = employer_total = net_total = cost_total = ZERO
            exceptions = 0

            items_this_run = []
            for person in members:
                pid = person["id"]
                basic = dec(person["base_amount"])
                housing = money(basic * Decimal("0.10"))
                transport = Decimal("800.00")
                medical = Decimal("500.00")
                gross = money(basic + housing + transport + medical)
                taxable_gross = money(basic + housing)

                t1_employee = money(basic * Decimal("0.055"))
                t1_employer = money(basic * Decimal("0.13"))
                t2_employer = money(basic * Decimal("0.05"))

                taxable_income = max(taxable_gross - t1_employee, ZERO)
                paye = progressive_tax(taxable_income, bands)

                loan_amount = person["loan_installment"] or ZERO
                employee_deductions = money(t1_employee + paye + loan_amount)
                employer_contributions = money(t1_employer + t2_employer)
                net = money(gross - employee_deductions)
                employer_cost = money(gross + employer_contributions)

                item_id = uuid.uuid4()
                items_this_run.append(item_id)

                period_ts = [
                    row
                    for row in ts_by_person.get(pid, [])
                    if start <= row["week_start_date"] <= end
                ]
                regular_hours = money(sum((dec(r["total_hours"]) for r in period_ts), ZERO))

                snapshot = {
                    "department": person["department"],
                    "cost_center": person["cost_center"],
                    "regular_hours": str(regular_hours),
                    "overtime_hours": "0.00",
                    "basic_pay": str(basic),
                    "taxable_gross": str(taxable_gross),
                    "pay_group": group,
                    "pay_date": pay_date.isoformat(),
                }

                item_rows.append(
                    {
                        "id": item_id,
                        "run_id": run_id,
                        "person_id": pid,
                        "person_name": person["name"],
                        "employee_number": person["employee_number"],
                        "department": person["department"],
                        "cost_center": person["cost_center"],
                        "pay_type": "salaried",
                        "currency": "GHS",
                        "regular_hours": regular_hours,
                        "overtime_hours": ZERO,
                        "unpaid_leave_days": ZERO,
                        "gross_pay": gross,
                        "total_employee_deductions": employee_deductions,
                        "total_employer_contributions": employer_contributions,
                        "net_pay": net,
                        "employer_cost": employer_cost,
                        "status": "calculated",
                        "exception_summary": None,
                        "calculation_snapshot": json.dumps(snapshot),
                        "created_at": at(pay_date - dt.timedelta(days=6), 10),
                        "updated_at": at(pay_date - dt.timedelta(days=6), 10),
                    }
                )

                def add_line(code, label, category, amount, taxable, statutory, employer, source, priority, quantity=None, rate=None, component=None, notes=None):
                    line_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "run_item_id": item_id,
                            "component_type_id": component,
                            "code": code,
                            "name": label,
                            "category": category,
                            "quantity": quantity,
                            "rate": rate,
                            "amount": amount,
                            "taxable": taxable,
                            "statutory": statutory,
                            "employer": employer,
                            "source": source,
                            "source_ref": None,
                            "priority": priority,
                            "notes": notes,
                            "created_at": at(pay_date - dt.timedelta(days=6), 10),
                            "updated_at": at(pay_date - dt.timedelta(days=6), 10),
                        }
                    )

                add_line("BASIC", "Basic salary", "earning", basic, "yes", "no", "no", "profile", 10, component=COMPONENTS["BASIC"])
                add_line("TRANSPORT", "Transport Allowance", "earning", transport, "no", "no", "no", "recurring", 20, component=COMPONENTS["TRANSPORT"])
                add_line("HOUSING", "Housing Allowance", "earning", housing, "yes", "no", "no", "recurring", 30, rate=Decimal("0.100000"), component=COMPONENTS["HOUSING"])
                add_line("MEDICAL", "Medical Allowance", "earning", medical, "no", "no", "no", "recurring", 40, component=COMPONENTS["MEDICAL"])
                add_line("T1", "SSNIT Tier 1", "employee_deduction", t1_employee, "no", "yes", "no", "statutory", 100, rate=Decimal("0.055000"))
                add_line("T1_EMPLOYER", "SSNIT Tier 1 (employer)", "employer_contribution", t1_employer, "no", "yes", "yes", "statutory", 100, rate=Decimal("0.130000"))
                add_line("T2_EMPLOYER", "Tier 2 Pension (employer)", "employer_contribution", t2_employer, "no", "yes", "yes", "statutory", 110, rate=Decimal("0.050000"))
                add_line("PAYE", "PAYE Income Tax", "employee_deduction", paye, "no", "yes", "no", "statutory", 200)
                if loan_amount > ZERO:
                    add_line("STAFF_LOAN", "Staff loan repayment", "employee_deduction", loan_amount, "no", "no", "no", "loan", 200, notes="Staff loan repayment")

                if status in ("paid", "finalized", "disbursing"):
                    prior = ytd[pid]
                    payslip_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "run_item_id": item_id,
                            "person_id": pid,
                            "period_id": period_id,
                            "gross_pay": gross,
                            "total_deductions": employee_deductions,
                            "net_pay": net,
                            "ytd_gross": money(prior[0] + gross),
                            "ytd_deductions": money(prior[1] + employee_deductions),
                            "ytd_net": money(prior[2] + net),
                            "status": "issued",
                            "version": 1,
                            "issued_at": at(pay_date, 9),
                            "viewed_at": at(pay_date, 11) if person["employee_number"] != "SHO-020" else None,
                            "created_at": at(pay_date, 9),
                            "updated_at": at(pay_date, 9),
                        }
                    )
                    ytd[pid] = [prior[0] + gross, prior[1] + employee_deductions, prior[2] + net]

                gross_total += gross
                employee_total += employee_deductions
                employer_total += employer_contributions
                net_total += net
                cost_total += employer_cost

                for ts in period_ts:
                    ts_lock_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "run_id": run_id,
                            "timesheet_id": ts["id"],
                            "person_id": pid,
                            "week_start_date": ts["week_start_date"],
                            "week_end_date": ts["week_end_date"],
                            "total_hours": dec(ts["total_hours"]),
                            "overtime_hours": ZERO,
                            "locked_at": at(pay_date - dt.timedelta(days=6), 10),
                            "created_at": at(pay_date - dt.timedelta(days=6), 10),
                            "updated_at": at(pay_date - dt.timedelta(days=6), 10),
                        }
                    )

            prepared = at(pay_date - dt.timedelta(days=8), 15)
            hr_at = at(pay_date - dt.timedelta(days=4), 10)
            finance_at = at(pay_date - dt.timedelta(days=3), 14)
            final_at = at(pay_date - dt.timedelta(days=1), 11)

            run_rows.append(
                {
                    "id": run_id,
                    "run_number": run_number,
                    "period_id": period_id,
                    "pay_group_id": groups[group],
                    "run_type": "regular",
                    "status": status,
                    "currency": "GHS",
                    "total_gross": money(gross_total),
                    "total_employee_deductions": money(employee_total),
                    "total_employer_contributions": money(employer_total),
                    "total_net": money(net_total),
                    "total_employer_cost": money(cost_total),
                    "employee_count": len(members),
                    "exception_count": exceptions,
                    "calculation_hash": hashlib.sha256(f"{run_number}:{gross_total}".encode()).hexdigest(),
                    "prepared_by_id": PEOPLE["gifty"],
                    "hr_approved_by_id": PEOPLE["efua"] if status in ("hr_approved", "finance_approved", "approved", "finalized", "paid") else None,
                    "hr_approved_at": hr_at if status in ("hr_approved", "finance_approved", "approved", "finalized", "paid") else None,
                    "finance_approved_by_id": PEOPLE["salome"] if status in ("finance_approved", "approved", "finalized", "paid") else None,
                    "finance_approved_at": finance_at if status in ("finance_approved", "approved", "finalized", "paid") else None,
                    "approved_by_id": PEOPLE["william"] if status in ("approved", "finalized", "paid") else None,
                    "approved_at": final_at if status in ("approved", "finalized", "paid") else None,
                    "finalized_at": at(pay_date, 8) if status in ("finalized", "paid") else None,
                    "paid_at": at(pay_date, 12) if status == "paid" else None,
                    "notes": f"Monthly payroll for {group} group — {name}",
                    "created_at": prepared,
                    "updated_at": at(pay_date, 12) if status == "paid" else prepared,
                }
            )

            stages = [("hr", PEOPLE["efua"], hr_at, "Headcount and hours look correct.")]
            if status in ("finance_approved", "approved", "finalized", "paid"):
                stages.append(("finance", PEOPLE["salome"], finance_at, "Statutory rates and bank details verified."))
            if status in ("approved", "finalized", "paid"):
                stages.append(("final", PEOPLE["william"], final_at, "Approved for payment."))
            for stage, actor, decided, note in stages:
                approval_rows.append(
                    {
                        "id": uuid.uuid4(),
                        "run_id": run_id,
                        "stage": stage,
                        "decision": "approved",
                        "actor_person_id": actor,
                        "note": note,
                        "decided_at": decided,
                        "created_at": decided,
                        "updated_at": decided,
                    }
                )

            if status == "paid":
                t1_emp = money(sum((dec(r["amount"]) for r in line_rows if r["run_item_id"] in items_this_run and r["code"] == "T1"), ZERO))
                paye_total = money(sum((dec(r["amount"]) for r in line_rows if r["run_item_id"] in items_this_run and r["code"] == "PAYE"), ZERO))
                t1_er = money(sum((dec(r["amount"]) for r in line_rows if r["run_item_id"] in items_this_run and r["code"] == "T1_EMPLOYER"), ZERO))
                t2_er = money(sum((dec(r["amount"]) for r in line_rows if r["run_item_id"] in items_this_run and r["code"] == "T2_EMPLOYER"), ZERO))
                loan_total = money(sum((dec(r["amount"]) for r in line_rows if r["run_item_id"] in items_this_run and r["code"] == "STAFF_LOAN"), ZERO))

                next_month = pay_date.month % 12 + 1
                next_year = pay_date.year + (1 if pay_date.month == 12 else 0)
                due_date = dt.date(next_year, next_month, 14)
                remit_specs = [
                    ("SSNIT Tier 1", SCHEMES["T1"], t1_emp, t1_er, "SSNIT"),
                    ("Tier 2 Pension", SCHEMES["T2"], ZERO, t2_er, "TIER2"),
                    ("PAYE", SCHEMES["PAYE"], paye_total, ZERO, "GRA"),
                ]
                for scheme_name, scheme_id, emp, er, prefix in remit_specs:
                    total = money(emp + er)
                    if total == ZERO:
                        continue
                    paid_day = dt.date(pay_date.year, pay_date.month, 10) + dt.timedelta(days=35)
                    remit_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "run_id": run_id,
                            "scheme_id": scheme_id,
                            "scheme_name": scheme_name,
                            "employee_amount": money(emp),
                            "employer_amount": money(er),
                            "total_amount": total,
                            "due_date": due_date,
                            "status": "paid" if month_key in ("2026-08", "2026-09") else "pending",
                            "paid_at": at(paid_day, 10) if month_key in ("2026-08", "2026-09") else None,
                            "reference": f"{prefix}-{month_key}-{run_number[-4:]}",
                            "created_at": at(pay_date, 12),
                            "updated_at": at(pay_date, 12),
                        }
                    )

                by_center = {}
                er_by_center = {}
                for item in item_rows:
                    if item["run_id"] == run_id:
                        by_center[item["cost_center"]] = by_center.get(item["cost_center"], ZERO) + dec(item["gross_pay"])
                        er_by_center[item["cost_center"]] = er_by_center.get(item["cost_center"], ZERO) + dec(item["total_employer_contributions"])
                for center, amount in by_center.items():
                    gl_rows.append(
                        {
                            "id": uuid.uuid4(), "run_id": run_id, "entry_date": pay_date,
                            "account_code": "6100", "account_name": "Salaries and wages",
                            "description": f"Payroll {run_number}", "cost_center": center,
                            "debit": money(amount), "credit": ZERO, "status": "posted",
                            "posted_at": at(pay_date, 12), "created_at": at(pay_date, 12),
                            "updated_at": at(pay_date, 12),
                        }
                    )
                for center, amount in er_by_center.items():
                    gl_rows.append(
                        {
                            "id": uuid.uuid4(), "run_id": run_id, "entry_date": pay_date,
                            "account_code": "6110", "account_name": "Employer statutory contributions",
                            "description": f"Payroll {run_number}", "cost_center": center,
                            "debit": money(amount), "credit": ZERO, "status": "posted",
                            "posted_at": at(pay_date, 12), "created_at": at(pay_date, 12),
                            "updated_at": at(pay_date, 12),
                        }
                    )
                credits = [
                    ("2200", "Net pay payable", net_total, "Employee net pay"),
                    ("2210", "Statutory payables", money(t1_emp + paye_total + t1_er + t2_er), "PAYE, social security and other statutory liabilities"),
                    ("1300", "Staff loans receivable", loan_total, "Staff loan repayments"),
                ]
                for code, account, amount, description in credits:
                    if amount == ZERO:
                        continue
                    gl_rows.append(
                        {
                            "id": uuid.uuid4(), "run_id": run_id, "entry_date": pay_date,
                            "account_code": code, "account_name": account,
                            "description": description, "cost_center": None,
                            "debit": ZERO, "credit": money(amount), "status": "posted",
                            "posted_at": at(pay_date, 12), "created_at": at(pay_date, 12),
                            "updated_at": at(pay_date, 12),
                        }
                    )

                batch_id = uuid.uuid4()
                batch_rows.append(
                    {
                        "id": batch_id,
                        "batch_number": f"DB-{month_key}-{'LEAD' if group == 'Leadership' else 'HO'}",
                        "run_id": run_id,
                        "method": "bank_transfer",
                        "currency": "GHS",
                        "pay_date": pay_date,
                        "status": "paid",
                        "control_count": len(members),
                        "control_total": money(net_total),
                        "bank_file_reference": f"GCB-PAY-{month_key}-{run_number[-4:]}",
                        "bank_file_hash": hashlib.sha256(run_number.encode()).hexdigest(),
                        "provider_reference": f"GCB{month_key.replace('-', '')}{run_sequence:04d}",
                        "created_by_id": PEOPLE["gifty"],
                        "approved_by_id": PEOPLE["salome"],
                        "approved_at": at(pay_date, 10),
                        "submitted_at": at(pay_date, 11),
                        "paid_at": at(pay_date, 12),
                        "notes": "Bank transfer batch uploaded to GCB Corporate Portal.",
                        "created_at": at(pay_date, 9),
                        "updated_at": at(pay_date, 12),
                    }
                )
                for item in item_rows:
                    if item["run_id"] != run_id:
                        continue
                    person = next(p for p in staff if p["id"] == item["person_id"])
                    method = person["payment_method"]
                    if method == "mobile_money":
                        destination = f"{person['mobile_provider'] or 'MTN MoMo'} ••••{person['account_last4']}"
                    else:
                        destination = f"{person['bank_name']} ••••{person['account_last4']}"
                    batch_item_rows.append(
                        {
                            "id": uuid.uuid4(),
                            "batch_id": batch_id,
                            "run_item_id": item["id"],
                            "person_id": item["person_id"],
                            "person_name": item["person_name"],
                            "employee_number": item["employee_number"],
                            "amount": item["net_pay"],
                            "method": method,
                            "destination_masked": destination,
                            "status": "paid",
                            "failure_reason": None,
                            "retry_count": 0,
                            "provider_reference": f"TXN{month_key.replace('-', '')}{item['employee_number'][-3:]}",
                            "paid_at": at(pay_date, 12),
                            "created_at": at(pay_date, 9),
                            "updated_at": at(pay_date, 12),
                        }
                    )

            if month_key == "2026-10" and group == "Leadership":
                batch_rows.append(
                    {
                        "id": uuid.uuid4(),
                        "batch_number": "DB-2026-10-LEAD",
                        "run_id": run_id,
                        "method": "bank_transfer",
                        "currency": "GHS",
                        "pay_date": pay_date,
                        "status": "draft",
                        "control_count": len(members),
                        "control_total": money(net_total),
                        "bank_file_reference": None,
                        "bank_file_hash": None,
                        "provider_reference": None,
                        "created_by_id": PEOPLE["gifty"],
                        "approved_by_id": None,
                        "approved_at": None,
                        "submitted_at": None,
                        "paid_at": None,
                        "notes": "Awaiting finance approval before upload.",
                        "created_at": at(dt.date(2026, 10, 27), 15),
                        "updated_at": at(dt.date(2026, 10, 27), 15),
                    }
                )

    await insert_many(conn, "payroll_runs", run_rows)
    await insert_many(conn, "payroll_run_items", item_rows)
    await insert_many(conn, "payroll_run_lines", line_rows)
    await insert_many(conn, "payroll_run_approvals", approval_rows)
    await insert_many(conn, "payroll_run_timesheets", ts_lock_rows)
    await insert_many(conn, "payroll_payslips", payslip_rows)
    await insert_many(conn, "payroll_statutory_remittances", remit_rows)
    await insert_many(conn, "payroll_gl_entries", gl_rows)
    await insert_many(conn, "payroll_disbursement_batches", batch_rows)
    await insert_many(conn, "payroll_disbursement_items", batch_item_rows)

    # ---------------- loan installments ----------------
    loans = await conn.fetch(
        "SELECT id, person_id, principal, installment_amount, term_months, start_date FROM payroll_loans"
    )
    installment_rows = []
    balance_updates = []
    await conn.execute(
        "DELETE FROM payroll_loan_installments WHERE loan_id = ANY($1::uuid[])",
        [loan["id"] for loan in loans],
    )
    for loan in loans:
        paid_total = ZERO
        for seq in range(1, loan["term_months"] + 1):
            month_date = dt.date(loan["start_date"].year, loan["start_date"].month, 1)
            total_months = month_date.month - 1 + (seq - 1)
            year = month_date.year + total_months // 12
            month = total_months % 12 + 1
            due = month_end(year, month)
            status = "pending"
            paid_at = None
            item_id = None
            if due <= dt.date(2026, 9, 30):
                status = "paid"
                paid_at = at(due, 12)
                for item in item_rows:
                    if item["person_id"] != loan["person_id"]:
                        continue
                    run = next(r for r in run_rows if r["id"] == item["run_id"])
                    period = next(p for p in periods if period_ids[p[0]][0] == run["period_id"])
                    if period[3] == due or (
                        period[3].year == due.year
                        and period[3].month == due.month
                        and run["status"] == "paid"
                    ):
                        item_id = item["id"]
                        break
                paid_total += dec(loan["installment_amount"])
            installment_rows.append(
                {
                    "id": uuid.uuid4(),
                    "loan_id": loan["id"],
                    "sequence": seq,
                    "due_date": due,
                    "amount": loan["installment_amount"],
                    "principal_portion": loan["installment_amount"],
                    "interest_portion": ZERO,
                    "status": status,
                    "pay_run_item_id": item_id,
                    "paid_at": paid_at,
                    "created_at": at(loan["start_date"], 9),
                    "updated_at": at(loan["start_date"], 9),
                }
            )
        balance_updates.append((money(dec(loan["principal"]) - paid_total), loan["id"]))

    await insert_many(conn, "payroll_loan_installments", installment_rows)
    for balance, loan_id in balance_updates:
        await conn.execute(
            "UPDATE payroll_loans SET outstanding_balance = $1, updated_at = $2 WHERE id = $3",
            balance,
            NOW,
            loan_id,
        )

    # ---------------- pay adjustments ----------------
    adjustments = [
        {
            "id": uuid.uuid4(),
            "person_id": PEOPLE["kofi"],
            "source_run_id": None,
            "target_period_id": period_ids["October 2026"][0],
            "adjustment_type": "earning",
            "amount": Decimal("750.00"),
            "reason": "Approved overtime correction for the September close-out weekend.",
            "status": "approved",
            "created_by_id": PEOPLE["efua"],
            "created_at": at(dt.date(2026, 10, 20), 11),
            "updated_at": at(dt.date(2026, 10, 21), 9),
        },
        {
            "id": uuid.uuid4(),
            "person_id": PEOPLE["gifty"],
            "source_run_id": None,
            "target_period_id": period_ids["October 2026"][0],
            "adjustment_type": "deduction",
            "amount": Decimal("200.00"),
            "reason": "Recovery of a duplicate per-diem advance paid in September.",
            "status": "pending",
            "created_by_id": PEOPLE["salome"],
            "created_at": at(dt.date(2026, 10, 24), 16),
            "updated_at": at(dt.date(2026, 10, 24), 16),
        },
    ]
    await insert_many(conn, "payroll_adjustments", adjustments)

    return {
        "periods": len(period_rows),
        "runs": len(run_rows),
        "items": len(item_rows),
        "lines": len(line_rows),
        "payslips": len(payslip_rows),
        "remittances": len(remit_rows),
        "gl": len(gl_rows),
        "batches": len(batch_rows),
        "batch_items": len(batch_item_rows),
        "installments": len(installment_rows),
    }


async def seed_finance(conn):
    p = PEOPLE
    d = DEPT

    budgets = [
        ("BUD-2026-001", "FY2026 Operating Budget", "1,200,000", "active", dt.date(2026, 1, 1), dt.date(2026, 12, 31), None, "EXEC"),
        ("BUD-2026-002", "Education & Training Budget", "900,000", "active", dt.date(2026, 1, 1), dt.date(2026, 12, 31), None, "EDU"),
        ("BUD-2026-003", "Programme Delivery Budget", "1,500,000", "active", dt.date(2026, 1, 1), dt.date(2026, 12, 31), PROGRAMMES["P1"], "PROG"),
        ("BUD-2026-004", "Communications Budget", "250,000", "submitted", dt.date(2026, 1, 1), dt.date(2026, 12, 31), None, "COMM"),
        ("BUD-2025-001", "FY2025 Operating Budget", "800,000", "closed", dt.date(2025, 1, 1), dt.date(2025, 12, 31), None, "EXEC"),
    ]
    budget_ids = {}
    budget_rows = []
    for number, name, amount, status, start, end, programme, dept in budgets:
        bid = uuid.uuid4()
        budget_ids[number] = bid
        submitted = at(dt.date(2026, 1, 5), 10) if status != "draft" else None
        approved = at(dt.date(2026, 1, 8), 14) if status in ("approved", "active", "closed") else None
        activated = at(dt.date(2026, 1, 10), 9) if status in ("active", "closed") else None
        closed = at(dt.date(2026, 9, 30), 16) if status == "closed" else None
        budget_rows.append(
            {
                "id": bid,
                "budget_number": number,
                "name": name,
                "description": f"{name} for the Shoova Initiative.",
                "fiscal_year": "2025" if number.startswith("BUD-2025") else "2026",
                "start_date": start,
                "end_date": end,
                "amount": amt(amount),
                "currency": "GHS",
                "status": status,
                "organisation_id": ORG,
                "department_id": d[dept],
                "programme_id": programme,
                "project_id": None,
                "notes": None,
                "submitted_at": submitted,
                "approved_at": approved,
                "activated_at": activated,
                "closed_at": closed,
                "submitted_by_id": p["salome"],
                "approved_by_id": p["william"] if approved else None,
                "activated_by_id": p["salome"] if activated else None,
                "closed_by_id": p["salome"] if closed else None,
                "created_by_id": p["salome"],
                "created_at": at(dt.date(2026, 1, 3), 9),
                "updated_at": at(dt.date(2026, 1, 10), 9),
            }
        )
    await insert_many(conn, "budgets", budget_rows)

    allocations = [
        ("ALLOC-2026-001", budget_ids["BUD-2026-001"], "Head Office Payroll", "300000", "active", None, "FIN", None, None),
        ("ALLOC-2026-002", budget_ids["BUD-2026-001"], "IT Infrastructure", "120000", "active", None, "OPS", None, None),
        ("ALLOC-2026-003", budget_ids["BUD-2026-002"], "Digital Skills Cohort Delivery", "250000", "active", None, "EDU", PROGRAMMES["P1"], None),
        ("ALLOC-2026-004", budget_ids["BUD-2026-003"], "Community Health Outreach", "180000", "approved", None, "PROG", PROGRAMMES["P3"], PROJECTS["PRG-CHO"]),
        ("ALLOC-2026-005", budget_ids["BUD-2026-003"], "Youth Entrepreneurship Accelerator", "220000", "submitted", None, "PROG", PROGRAMMES["P2"], PROJECTS["PRG-GYEA"]),
        ("ALLOC-2026-006", budget_ids["BUD-2026-004"], "Brand Awareness Campaign", "60000", "draft", None, "COMM", None, None),
        ("ALLOC-2025-007", budget_ids["BUD-2025-001"], "FY2025 Close-out", "50000", "closed", None, "EXEC", None, None),
    ]
    allocation_rows = []
    for number, budget_id, name, amount, status, programme, dept, programme_id, project_id in allocations:
        submitted = at(dt.date(2026, 2, 3), 10) if status in ("submitted", "approved", "active", "closed") else None
        approved = at(dt.date(2026, 2, 6), 11) if status in ("approved", "active", "closed") else None
        activated = at(dt.date(2026, 2, 10), 9) if status in ("active", "closed") else None
        closed = at(dt.date(2026, 9, 30), 16) if status == "closed" else None
        allocation_rows.append(
            {
                "id": uuid.uuid4(),
                "allocation_number": number,
                "budget_id": budget_id,
                "name": name,
                "description": f"{name} allocation.",
                "amount": amt(amount),
                "currency": "GHS",
                "status": status,
                "organisation_id": ORG,
                "department_id": d[dept],
                "programme_id": programme_id,
                "project_id": project_id,
                "notes": None,
                "submitted_at": submitted,
                "approved_at": approved,
                "activated_at": activated,
                "closed_at": closed,
                "submitted_by_id": p["salome"],
                "approved_by_id": p["william"] if approved else None,
                "activated_by_id": p["salome"] if activated else None,
                "closed_by_id": p["salome"] if closed else None,
                "created_by_id": p["salome"],
                "created_at": at(dt.date(2026, 2, 1), 9),
                "updated_at": at(dt.date(2026, 2, 10), 9),
            }
        )
    await insert_many(conn, "allocations", allocation_rows)

    fund_rows = [
        ("FR-2026-001", "Digital Learning Platform hosting & licences", "PRG-DLP", "julius", "45000", "reconciled", dt.date(2026, 8, 3)),
        ("FR-2026-002", "Community health outreach supplies", "PRG-CHO", "daniel", "28500", "disbursed", dt.date(2026, 8, 18)),
        ("FR-2026-003", "Youth accelerator seed grants", "PRG-GYEA", "daniel", "60000", "approved", dt.date(2026, 9, 14)),
        ("FR-2026-004", "Quarterly staff training", None, "efua", "15000", "under_review", dt.date(2026, 10, 6)),
        ("FR-2026-005", "Office equipment refresh", None, "solomon", "9800", "submitted", dt.date(2026, 10, 20)),
        ("FR-2026-006", "STEM lab equipment", "PRG-STEM", "isaac", "120000", "rejected", dt.date(2026, 9, 2)),
        ("FR-2026-007", "Field travel advance — Kumasi", None, "kofi", "7500", "draft", dt.date(2026, 10, 27)),
    ]
    fund_request_rows = []
    for number, title, project, requester, amount, status, submitted_day in fund_rows:
        submitted = at(submitted_day, 9) if status != "draft" else None
        reviewed = at(submitted_day + dt.timedelta(days=2), 11) if status in ("under_review", "approved", "rejected", "disbursed", "reconciled") else None
        approved = at(submitted_day + dt.timedelta(days=4), 10) if status in ("approved", "disbursed", "reconciled") else None
        disbursed = at(submitted_day + dt.timedelta(days=8), 14) if status in ("disbursed", "reconciled") else None
        reconciled = at(submitted_day + dt.timedelta(days=20), 15) if status == "reconciled" else None
        fund_request_rows.append(
            {
                "id": uuid.uuid4(),
                "request_number": number,
                "title": title,
                "description": f"{title}.",
                "justification": "Approved programme activity with supporting quotations on file.",
                "requester_id": p[requester],
                "project_id": PROJECTS[project] if project else None,
                "programme_id": None,
                "department_id": d["PROG"] if project else None,
                "amount_requested": amt(amount),
                "currency": "GHS",
                "approved_amount": amt(amount) if status in ("approved", "disbursed", "reconciled") else None,
                "amount_disbursed": amt(amount) if status in ("disbursed", "reconciled") else ZERO,
                "status": status,
                "required_by_date": submitted_day + dt.timedelta(days=14),
                "submitted_at": submitted,
                "reviewed_at": reviewed,
                "approved_at": approved,
                "disbursed_at": disbursed,
                "reconciled_at": reconciled,
                "reviewer_id": p["salome"] if reviewed else None,
                "approver_id": p["william"] if approved else None,
                "disburser_id": p["gifty"] if disbursed else None,
                "reconciler_id": p["salome"] if reconciled else None,
                "rejection_reason": "Amount exceeds the approved allocation for the period; resubmit with a phased plan." if status == "rejected" else None,
                "review_notes": "Supporting documents verified." if reviewed else None,
                "approval_notes": "Approved as budgeted." if approved else None,
                "disbursement_notes": "Funds transferred to programme account." if disbursed else None,
                "reconciliation_notes": "Receipts and activity report received." if reconciled else None,
                "created_at": at(submitted_day - dt.timedelta(days=3), 10),
                "updated_at": at(submitted_day, 9),
            }
        )
    await insert_many(conn, "fund_requests", fund_request_rows)

    expense_specs = [
        ("EXP-2026-001", "Cohort graduation venue", "Programme Delivery", "12400", "michael", "PRG-DLP", "reconciled", dt.date(2026, 8, 12)),
        ("EXP-2026-002", "Team lunch — planning retreat", "Meals & Entertainment", "3250", "freda", None, "paid", dt.date(2026, 8, 21)),
        ("EXP-2026-003", "Laptop repairs", "IT & Equipment", "8900", "kofi", None, "approved", dt.date(2026, 9, 9)),
        ("EXP-2026-004", "Transport for field visit", "Travel", "5600", "samuel", "PRG-CHO", "under_review", dt.date(2026, 9, 24)),
        ("EXP-2026-005", "Printing of training manuals", "Programme Delivery", "2100", "abena", "PRG-DLP", "submitted", dt.date(2026, 10, 8)),
        ("EXP-2026-006", "Office supplies", "Administration", "1850", "adwoa", None, "draft", dt.date(2026, 10, 22)),
        ("EXP-2026-007", "Venue deposit — entrepreneurship bootcamp", "Programme Delivery", "18000", "daniel", "PRG-GYEA", "rejected", dt.date(2026, 9, 3)),
        ("EXP-2026-008", "Internet & data bundles", "IT & Equipment", "6750", "comfort", None, "paid", dt.date(2026, 10, 2)),
    ]
    expense_rows = []
    for number, title, category, amount, requester, project, status, incurred in expense_specs:
        submitted = at(incurred + dt.timedelta(days=1), 9) if status != "draft" else None
        reviewed = at(incurred + dt.timedelta(days=3), 10) if status in ("under_review", "approved", "paid", "reconciled") else None
        approved = at(incurred + dt.timedelta(days=5), 11) if status in ("approved", "paid", "reconciled") else None
        paid = at(incurred + dt.timedelta(days=9), 14) if status in ("paid", "reconciled") else None
        reconciled = at(incurred + dt.timedelta(days=16), 15) if status == "reconciled" else None
        expense_rows.append(
            {
                "id": uuid.uuid4(),
                "expense_number": number,
                "title": title,
                "description": f"{title} — Shoova Initiative.",
                "category": category,
                "amount": amt(amount),
                "currency": "GHS",
                "incurred_date": incurred,
                "requester_id": p[requester],
                "project_id": PROJECTS[project] if project else None,
                "programme_id": None,
                "department_id": None,
                "vendor_name": "Accra Business Services Ltd",
                "vendor_reference": f"INV-{number[-3:]}",
                "payment_method": "bank_transfer",
                "status": status,
                "submitted_at": submitted,
                "reviewed_at": reviewed,
                "approved_at": approved,
                "paid_at": paid,
                "reconciled_at": reconciled,
                "reviewer_id": p["salome"] if reviewed else None,
                "approver_id": p["william"] if approved else None,
                "payer_id": p["gifty"] if paid else None,
                "reconciler_id": p["salome"] if reconciled else None,
                "review_notes": "Receipts match the claim." if reviewed else None,
                "approval_notes": "Approved for payment." if approved else None,
                "rejection_reason": "Deposit exceeds policy limit without a signed contract." if status == "rejected" else None,
                "payment_notes": "Paid by bank transfer." if paid else None,
                "reconciliation_notes": "Matched to bank statement." if reconciled else None,
                "created_at": at(incurred, 8),
                "updated_at": at(incurred, 8),
            }
        )
    await insert_many(conn, "expenses", expense_rows)

    reimbursement_specs = [
        ("RMB-2026-001", "Taxi to Ministry meeting", "Travel", "1200", "gifty", "paid", dt.date(2026, 8, 14)),
        ("RMB-2026-002", "Staff welfare snacks", "Welfare", "850", "akosua", "approved", dt.date(2026, 9, 11)),
        ("RMB-2026-003", "Hotel — stakeholder workshop", "Travel", "2400", "nana", "under_review", dt.date(2026, 9, 29)),
        ("RMB-2026-004", "Courier documents", "Administration", "600", "wemba", "submitted", dt.date(2026, 10, 13)),
        ("RMB-2026-005", "Client lunch", "Meals & Entertainment", "3100", "salome", "reconciled", dt.date(2026, 8, 28)),
    ]
    reimbursement_rows = []
    for number, title, category, amount, requester, status, incurred in reimbursement_specs:
        submitted = at(incurred + dt.timedelta(days=1), 9) if status != "draft" else None
        reviewed = at(incurred + dt.timedelta(days=3), 10) if status in ("under_review", "approved", "paid", "reconciled") else None
        approved = at(incurred + dt.timedelta(days=5), 11) if status in ("approved", "paid", "reconciled") else None
        paid = at(incurred + dt.timedelta(days=9), 14) if status in ("paid", "reconciled") else None
        reconciled = at(incurred + dt.timedelta(days=16), 15) if status == "reconciled" else None
        reimbursement_rows.append(
            {
                "id": uuid.uuid4(),
                "reimbursement_number": number,
                "title": title,
                "description": f"{title} — out-of-pocket staff expense.",
                "category": category,
                "amount": amt(amount),
                "currency": "GHS",
                "incurred_date": incurred,
                "requester_id": p[requester],
                "project_id": None,
                "programme_id": None,
                "department_id": None,
                "payment_method": "mobile_money",
                "vendor_name": None,
                "vendor_reference": None,
                "status": status,
                "submitted_at": submitted,
                "reviewed_at": reviewed,
                "approved_at": approved,
                "paid_at": paid,
                "reconciled_at": reconciled,
                "reviewer_id": p["salome"] if reviewed else None,
                "approver_id": p["william"] if approved else None,
                "payer_id": p["gifty"] if paid else None,
                "reconciler_id": p["salome"] if reconciled else None,
                "review_notes": "Receipt attached." if reviewed else None,
                "approval_notes": "Approved." if approved else None,
                "rejection_reason": None,
                "payment_notes": "Paid via mobile money." if paid else None,
                "reconciliation_notes": "Posted to petty cash." if reconciled else None,
                "created_at": at(incurred, 8),
                "updated_at": at(incurred, 8),
            }
        )
    await insert_many(conn, "reimbursements", reimbursement_rows)

    invoice_specs = [
        ("INV-2026-001", "Mastercard Foundation", "Digital Skills Programme Grant — Tranche 1", "250000", "paid", dt.date(2026, 8, 5), dt.date(2026, 9, 5), PROJECTS["PRG-DLP"], "programmes@mastercard.org"),
        ("INV-2026-002", "UNICEF Ghana", "Community Health Outreach co-funding", "120000", "partially_paid", dt.date(2026, 8, 20), dt.date(2026, 10, 20), PROJECTS["PRG-CHO"], "ghana@unicef.org"),
        ("INV-2026-003", "Stanbic Bank Ghana", "Corporate training services", "45000", "issued", dt.date(2026, 9, 15), dt.date(2026, 10, 15), None, "training@stanbic.com.gh"),
        ("INV-2026-004", "MTN Ghana Foundation", "STEM programme sponsorship", "80000", "draft", dt.date(2026, 10, 25), dt.date(2026, 11, 25), PROJECTS["PRG-STEM"], "foundation@mtn.com.gh"),
        ("INV-2026-005", "USAID Ghana", "Youth entrepreneurship grant", "200000", "cancelled", dt.date(2026, 8, 1), dt.date(2026, 9, 1), PROJECTS["PRG-GYEA"], "usaid-ghana@usaid.gov"),
    ]
    invoice_ids = {}
    invoice_rows = []
    for number, customer, title, amount, status, issued, due, project, email in invoice_specs:
        iid = uuid.uuid4()
        invoice_ids[number] = iid
        invoice_rows.append(
            {
                "id": iid,
                "invoice_number": number,
                "customer_name": customer,
                "customer_email": email,
                "customer_phone": None,
                "customer_address": "Accra, Ghana",
                "title": title,
                "description": f"{title}.",
                "amount": amt(amount),
                "amount_paid": ZERO,
                "currency": "GHS",
                "issue_date": issued,
                "due_date": due,
                "status": status,
                "project_id": project,
                "programme_id": None,
                "department_id": d["FIN"],
                "notes": None,
                "issued_at": at(issued, 9) if status != "draft" else None,
                "paid_at": None,
                "cancelled_at": at(dt.date(2026, 8, 2), 10) if status == "cancelled" else None,
                "cancellation_reason": "Grant agreement was withdrawn before disbursement." if status == "cancelled" else None,
                "created_by_id": p["salome"],
                "created_at": at(issued - dt.timedelta(days=2), 9),
                "updated_at": at(issued, 9),
            }
        )
    await insert_many(conn, "invoices", invoice_rows)

    payment_rows = [
        {
            "id": uuid.uuid4(),
            "payment_number": "PAY-2026-001",
            "invoice_id": invoice_ids["INV-2026-001"],
            "amount": Decimal("250000.00"),
            "currency": "GHS",
            "payment_date": dt.date(2026, 9, 2),
            "payment_method": "bank_transfer",
            "reference": "MC-2026-0902-4411",
            "payer_name": "Mastercard Foundation",
            "payer_email": "programmes@mastercard.org",
            "notes": "Tranche 1 received in full.",
            "status": "completed",
            "recorded_by_id": p["gifty"],
            "recorded_at": at(dt.date(2026, 9, 2), 11),
            "created_at": at(dt.date(2026, 9, 2), 11),
            "updated_at": at(dt.date(2026, 9, 2), 11),
        },
        {
            "id": uuid.uuid4(),
            "payment_number": "PAY-2026-002",
            "invoice_id": invoice_ids["INV-2026-002"],
            "amount": Decimal("60000.00"),
            "currency": "GHS",
            "payment_date": dt.date(2026, 9, 18),
            "payment_method": "bank_transfer",
            "reference": "UNICEF-2026-0918-7782",
            "payer_name": "UNICEF Ghana",
            "payer_email": "ghana@unicef.org",
            "notes": "First instalment; balance expected in November.",
            "status": "completed",
            "recorded_by_id": p["gifty"],
            "recorded_at": at(dt.date(2026, 9, 18), 13),
            "created_at": at(dt.date(2026, 9, 18), 13),
            "updated_at": at(dt.date(2026, 9, 18), 13),
        },
    ]
    await insert_many(conn, "payments", payment_rows)
    await conn.execute(
        "UPDATE invoices SET amount_paid = $1, paid_at = $2, updated_at = $2 WHERE id = $3",
        Decimal("250000.00"),
        at(dt.date(2026, 9, 2), 11),
        invoice_ids["INV-2026-001"],
    )
    await conn.execute(
        "UPDATE invoices SET amount_paid = $1, updated_at = $2 WHERE id = $3",
        Decimal("60000.00"),
        at(dt.date(2026, 9, 18), 13),
        invoice_ids["INV-2026-002"],
    )

    return {
        "budgets": len(budget_rows),
        "allocations": len(allocation_rows),
        "fund_requests": len(fund_request_rows),
        "expenses": len(expense_rows),
        "reimbursements": len(reimbursement_rows),
        "invoices": len(invoice_rows),
        "payments": len(payment_rows),
    }


async def seed_support(conn):
    p = PEOPLE
    u = USERS

    doc_types = {
        row["name"]: row["id"]
        for row in await conn.fetch("SELECT id, name FROM document_types")
    }
    document_rows = [
        ("Employment contract — William Agyekum", "Employment Contract", "william", "verified", dt.date(2026, 8, 1), None),
        ("Employment contract — Salome Agyekum", "Employment Contract", "salome", "verified", dt.date(2026, 8, 1), None),
        ("Employment contract — Kwame Opon-Yeboah", "Employment Contract", "kwame", "verified", dt.date(2026, 8, 1), None),
        ("Ghana Card — Julius Botchway", "Ghana Card", "julius", "verified", dt.date(2026, 8, 1), dt.date(2036, 7, 30)),
        ("Academic certificate — Efua Owusu-Ansah", "Academic Certificate", "efua", "verified", dt.date(2026, 8, 1), None),
        ("Police report — Michael Tetteh", "Police Report", "michael", "verified", dt.date(2026, 8, 5), dt.date(2027, 8, 4)),
        ("Bank account details — Gifty Amoako", "Bank Account Details", "gifty", "verified", dt.date(2026, 8, 1), None),
        ("CV — Daniel Osei-Bonsu", "CV / Resume", "daniel", "verified", dt.date(2026, 8, 1), None),
        ("Medical certificate — Abena Serwaa", "Medical Certificate", "abena", "pending", dt.date(2026, 9, 8), dt.date(2027, 9, 7)),
        ("Professional certification — Yaw Antwi", "Professional Certification", "yaw", "pending", dt.date(2026, 9, 15), None),
    ]
    document_inserts = []
    for name, type_name, owner, status, uploaded, expiry in document_rows:
        document_inserts.append(
            {
                "id": uuid.uuid4(),
                "name": name,
                "file_url": f"https://files.shoova.org/demo/{uuid.uuid4()}.pdf",
                "file_size_bytes": 348000,
                "mime_type": "application/pdf",
                "type": "hr",
                "owner_id": p[owner],
                "related_entity_type": "person",
                "related_entity_id": p[owner],
                "visibility": "internal",
                "version": 1,
                "deleted_at": None,
                "document_type_id": doc_types.get(type_name),
                "expiry_date": expiry,
                "verified": status == "verified",
                "verified_by": p["efua"] if status == "verified" else None,
                "verified_at": at(uploaded + dt.timedelta(days=1), 10) if status == "verified" else None,
                "created_at": at(uploaded, 9),
                "updated_at": at(uploaded, 9),
            }
        )
    await insert_many(conn, "documents", document_inserts)

    device_specs = [
        ("MacBook Pro 14-inch", "laptop", "MBP-14-2026-001", "Apple", "MacBook Pro M3", dt.date(2026, 7, 15), "excellent"),
        ("Dell Latitude 5440", "laptop", "DL-5440-2026-014", "Dell", "Latitude 5440", dt.date(2026, 7, 20), "good"),
        ("iPhone 13", "phone", "IP13-2026-032", "Apple", "iPhone 13", dt.date(2026, 7, 22), "good"),
        ("Epson projector", "projector", "EP-2026-007", "Epson", "EB-X49", dt.date(2026, 8, 3), "good"),
        ("TP-Link router", "network", "TPL-2026-011", "TP-Link", "Archer AX55", dt.date(2026, 8, 10), "good"),
        ("HP LaserJet printer", "printer", "HP-2026-004", "HP", "LaserJet Pro M404", dt.date(2026, 8, 18), "good"),
    ]
    device_rows = []
    device_ids = []
    for name, category, serial, brand, model, purchase, condition in device_specs:
        did = uuid.uuid4()
        device_ids.append(did)
        device_rows.append(
            {
                "id": did,
                "name": name,
                "category": category,
                "serial_number": serial,
                "brand": brand,
                "model": model,
                "purchase_date": purchase,
                "condition": condition,
                "notes": None,
                "created_at": at(purchase, 9),
                "updated_at": at(purchase, 9),
            }
        )
    await insert_many(conn, "devices", device_rows)

    assignment_specs = [
        (device_ids[0], "william", dt.date(2026, 7, 17), None),
        (device_ids[1], "gifty", dt.date(2026, 7, 24), None),
        (device_ids[2], "kwame", dt.date(2026, 7, 25), None),
        (device_ids[3], "freda", dt.date(2026, 8, 5), dt.date(2026, 9, 20)),
        (device_ids[5], "adwoa", dt.date(2026, 8, 20), None),
    ]
    assignment_rows = []
    for device_id, person, assigned, returned in assignment_specs:
        assignment_rows.append(
            {
                "id": uuid.uuid4(),
                "device_id": device_id,
                "person_id": p[person],
                "assigned_at": at(assigned, 10),
                "returned_at": at(returned, 15) if returned else None,
                "assigned_by": p["solomon"],
                "condition_on_assignment": "good",
                "condition_on_return": "good" if returned else None,
                "notes": None,
                "created_at": at(assigned, 10),
                "updated_at": at(assigned, 10),
            }
        )
    await insert_many(conn, "device_assignments", assignment_rows)

    note_rows = [
        ("michael", "efua", "performance", "Probation review — strong start", "Michael completed the Q3 programme reporting pack two days early. Recommend confirmation at the end of the probation period.", dt.date(2026, 10, 14)),
        ("akosua", "efua", "general", "Attendance follow-up", "Discussed late clock-ins on three mornings in September. Akosua confirmed transport issues and has adjusted her commute.", dt.date(2026, 9, 22)),
        ("kofi", "julius", "performance", "Certification progress", "Kofi passed the Cisco CCNA module 2 assessment. Enrolled for module 3 starting November.", dt.date(2026, 10, 6)),
        ("gifty", "salome", "general", "Payroll close recognition", "Gifty coordinated the August and September payroll closes without exceptions. Commended in the finance huddle.", dt.date(2026, 10, 2)),
        ("samuel", "solomon", "conduct", "Field safety briefing", "Completed refresher on field travel safety and vehicle log requirements before the Kumasi assignment.", dt.date(2026, 9, 16)),
    ]
    note_inserts = []
    for person, author, category, title, content, created in note_rows:
        note_inserts.append(
            {
                "id": uuid.uuid4(),
                "person_id": p[person],
                "author_id": p[author],
                "category": category,
                "title": title,
                "content": content,
                "is_sensitive": True,
                "created_at": at(created, 10),
                "updated_at": at(created, 10),
            }
        )
    await insert_many(conn, "hr_notes", note_inserts)

    comp_requests = [
        ("michael", "8500.00", "Completed probation with strong programme reporting; requesting salary review.", "pending_hr", None, None, None, None, dt.date(2026, 10, 20)),
        ("akosua", "7800.00", "Additional HR coordination duties since August.", "pending_ceo", p["efua"], dt.date(2026, 10, 12), None, None, dt.date(2026, 10, 5)),
        ("kofi", "8200.00", "Completed CCNA modules 1 and 2 and now supports network operations.", "approved", p["efua"], dt.date(2026, 9, 18), p["william"], dt.date(2026, 9, 24), dt.date(2026, 9, 1)),
    ]
    comp_rows = []
    for person, amount, reason, status, hr_by, hr_at_day, ceo_by, ceo_at_day, created in comp_requests:
        comp_rows.append(
            {
                "id": uuid.uuid4(),
                "person_id": p[person],
                "requested_amount": Decimal(amount),
                "currency": "GHS",
                "frequency": "monthly",
                "reason": reason,
                "status": status,
                "hr_decided_by_id": hr_by,
                "hr_decided_at": at(hr_at_day, 10) if hr_at_day else None,
                "hr_decision_note": "Recommended; forwarded to the CEO." if hr_by else None,
                "ceo_decided_by_id": ceo_by,
                "ceo_decided_at": at(ceo_at_day, 11) if ceo_at_day else None,
                "ceo_decision_note": "Approved effective next cycle." if ceo_by else None,
                "approval_id": None,
                "applied_change_id": None,
                "created_at": at(created, 9),
                "updated_at": at(created, 9),
            }
        )
    await insert_many(conn, "compensation_requests", comp_rows)

    # ---------------- chat ----------------
    leadership_users = [
        u[k] for k in (
            "william", "salome", "kwame", "julius", "wemba", "isaac",
            "nana", "freda", "solomon", "efua", "daniel",
        )
    ]
    conv_specs = [
        ("group", "Leadership Team", "Coordination space for the leadership team.", "active", leadership_users, "william"),
        ("direct", None, None, "active", [u["gifty"], u["salome"]], "gifty"),
        ("group", "Programme Delivery", "Weekly programme delivery stand-up.", "pending_approval", [u["daniel"], u["michael"], u["isaac"], u["freda"]], "daniel"),
    ]
    conv_rows, member_rows, message_rows = [], [], []
    conv_ids = []
    for conv_type, title, description, status, members, creator in conv_specs:
        cid = uuid.uuid4()
        conv_ids.append(cid)
        direct_key = None
        if conv_type == "direct":
            low, high = sorted(members)
            direct_key = f"{low}:{high}"
        conv_rows.append(
            {
                "id": cid,
                "type": conv_type,
                "title": title,
                "description": description,
                "status": status,
                "posting_policy": "all",
                "created_by": u[creator],
                "approved_by": u["william"] if status == "active" and conv_type == "group" else None,
                "approved_at": at(dt.date(2026, 8, 3), 9) if status == "active" and conv_type == "group" else None,
                "last_message_at": None,
                "requested_member_ids": json.dumps([str(m) for m in members]) if status == "pending_approval" else None,
                "direct_key": direct_key,
                "created_at": at(dt.date(2026, 8, 3), 9),
                "updated_at": at(dt.date(2026, 8, 3), 9),
            }
        )
        for member in members:
            member_rows.append(
                {
                    "id": uuid.uuid4(),
                    "conversation_id": cid,
                    "user_id": member,
                    "role": "owner" if member == u[creator] else "member",
                    "added_by": u[creator],
                    "last_read_at": at(dt.date(2026, 10, 28), 17),
                    "created_at": at(dt.date(2026, 8, 3), 9),
                    "updated_at": at(dt.date(2026, 8, 3), 9),
                }
            )

    message_specs = [
        (0, "william", "Welcome to the leadership channel. Use this space for cross-team updates.", dt.datetime(2026, 8, 3, 9, 15)),
        (0, "kwame", "Ghana operations weekly report is uploaded to the shared drive.", dt.datetime(2026, 8, 10, 10, 2)),
        (0, "salome", "August payroll closes on the 28th. Please approve outstanding timesheets by Wednesday.", dt.datetime(2026, 8, 24, 8, 45)),
        (0, "efua", "All leave requests for September should be in by Friday.", dt.datetime(2026, 8, 28, 11, 20)),
        (0, "daniel", "Cohort DSE-2026A results are finalised; certificates go out next week.", dt.datetime(2026, 9, 11, 14, 5)),
        (0, "william", "Great work on the Mastercard tranche. Finance has confirmed receipt.", dt.datetime(2026, 9, 3, 9, 30)),
        (0, "freda", "Press release for the health outreach is ready for review.", dt.datetime(2026, 9, 25, 15, 40)),
        (0, "salome", "September payroll approved and paid. Remittances scheduled for the 14th.", dt.datetime(2026, 9, 30, 16, 10)),
        (0, "william", "October payroll is with HR. Let's close before month end.", dt.datetime(2026, 10, 27, 9, 5)),
        (1, "gifty", "Salome, the UNICEF balance is still outstanding — should I send a reminder?", dt.datetime(2026, 10, 26, 10, 15)),
        (1, "salome", "Yes please, copy their programme officer. The invoice is due on the 20th.", dt.datetime(2026, 10, 26, 10, 22)),
        (1, "gifty", "Reminder sent. I'll flag it in the finance huddle on Friday.", dt.datetime(2026, 10, 26, 11, 0)),
        (2, "daniel", "Stand-up notes: two facilitators confirmed for the November cohort.", dt.datetime(2026, 10, 28, 9, 30)),
        (2, "michael", "Venue booking for the graduation is confirmed.", dt.datetime(2026, 10, 28, 9, 42)),
    ]
    last_by_conv = {}
    for conv_index, sender, body, created in message_specs:
        message_rows.append(
            {
                "id": uuid.uuid4(),
                "conversation_id": conv_ids[conv_index],
                "sender_id": u[sender],
                "body": body,
                "message_type": "text",
                "edited_at": None,
                "deleted_at": None,
                "created_at": created.replace(tzinfo=UTC),
                "updated_at": created.replace(tzinfo=UTC),
            }
        )
        last_by_conv[conv_index] = created.replace(tzinfo=UTC)
    for index, cid in enumerate(conv_ids):
        if index in last_by_conv:
            conv_rows[index]["last_message_at"] = last_by_conv[index]

    await insert_many(conn, "chat_conversations", conv_rows)
    await insert_many(conn, "chat_conversation_members", member_rows)
    await insert_many(conn, "chat_messages", message_rows)

    # ---------------- notifications ----------------
    notification_specs = [
        ("gifty", "Payroll run ready for review", "October payroll for the Leadership group has been approved by HR.", "payroll", False, "/payroll/runs"),
        ("salome", "Payroll awaiting finance approval", "October Leadership payroll is waiting for finance approval.", "payroll", False, "/payroll/runs"),
        ("efua", "Two leave requests pending", "Akosua Frimpong and Gifty Amoako have pending leave requests.", "leave", False, "/hr/leave"),
        ("william", "August payroll paid", "August payroll has been paid. Remittances are due within 14 days.", "payroll", True, "/payroll/runs"),
        ("michael", "Payslip available", "Your September payslip is now available to download.", "payroll", True, "/payroll/me"),
        ("daniel", "Cohort results finalised", "Results for DSE-2026A have been published.", "programmes", True, "/programmes"),
        ("salome", "Fund request reconciled", "FR-2026-001 has been reconciled.", "finance", True, "/finance/fund-requests"),
        ("gifty", "Invoice overdue", "INV-2026-003 is past its due date.", "finance", False, "/finance/invoices"),
        ("kwame", "Timesheet reminder", "Three team timesheets are still in draft.", "attendance", False, "/hr/timesheets"),
        ("julius", "New device assigned", "A Dell Latitude has been assigned to Gifty Amoako.", "hr", True, "/hr/devices"),
        ("freda", "Event reminder", "The Community Health Outreach event starts in three days.", "events", True, "/events"),
        ("william", "Chat mention", "Kwame mentioned you in the Leadership Team channel.", "chat", False, "/chat"),
    ]
    notification_rows = []
    for index, (user, title, body, type_, read, link) in enumerate(notification_specs):
        created = at(dt.date(2026, 10, 28) - dt.timedelta(days=index % 6), 9 + (index % 8))
        notification_rows.append(
            {
                "id": uuid.uuid4(),
                "user_id": u[user],
                "title": title,
                "body": body,
                "type": type_,
                "is_read": read,
                "link": link,
                "extra_data": None,
                "read_at": created + dt.timedelta(hours=2) if read else None,
                "created_at": created,
                "updated_at": created,
            }
        )
    await insert_many(conn, "notifications", notification_rows)

    # ---------------- audit logs ----------------
    runs = await conn.fetch("SELECT id, run_number, status FROM payroll_runs ORDER BY run_number")
    invoice_rows_db = await conn.fetch("SELECT id, invoice_number FROM invoices")
    budget_rows_db = await conn.fetch("SELECT id, budget_number FROM budgets")
    audit_rows = []
    audit_specs = [
        ("salome", "create", "budget", budget_rows_db[0]["id"], "Created FY2026 operating budget", dt.date(2026, 1, 3)),
        ("william", "approve", "budget", budget_rows_db[0]["id"], "Approved FY2026 operating budget", dt.date(2026, 1, 8)),
        ("gifty", "create", "invoice", invoice_rows_db[0]["id"], "Issued invoice INV-2026-001", dt.date(2026, 8, 5)),
        ("gifty", "record_payment", "invoice", invoice_rows_db[0]["id"], "Recorded payment PAY-2026-001", dt.date(2026, 9, 2)),
        ("salome", "create", "invoice", invoice_rows_db[1]["id"], "Issued invoice INV-2026-002", dt.date(2026, 8, 20)),
        ("efua", "approve", "leave_request", PEOPLE["michael"], "Approved annual leave for Michael Tetteh", dt.date(2026, 8, 3)),
        ("efua", "approve", "compensation_request", PEOPLE["kofi"], "Forwarded compensation request to the CEO", dt.date(2026, 9, 18)),
        ("william", "approve", "compensation_request", PEOPLE["kofi"], "Approved compensation request", dt.date(2026, 9, 24)),
        ("gifty", "prepare", "payroll_run", runs[0]["id"], f"Prepared payroll run {runs[0]['run_number']}", dt.date(2026, 8, 23)),
        ("efua", "approve", "payroll_run", runs[0]["id"], "HR approved August Leadership payroll", dt.date(2026, 8, 27)),
        ("salome", "approve", "payroll_run", runs[0]["id"], "Finance approved August Leadership payroll", dt.date(2026, 8, 28)),
        ("william", "finalize", "payroll_run", runs[0]["id"], "Final approval for August Leadership payroll", dt.date(2026, 8, 30)),
        ("gifty", "disburse", "payroll_run", runs[0]["id"], "Uploaded bank batch DB-2026-08-LEAD", dt.date(2026, 8, 31)),
        ("daniel", "create", "fund_request", PEOPLE["daniel"], "Created fund request FR-2026-002", dt.date(2026, 8, 15)),
        ("salome", "disburse", "fund_request", PEOPLE["daniel"], "Disbursed FR-2026-002", dt.date(2026, 8, 26)),
        ("salome", "reconcile", "fund_request", PEOPLE["daniel"], "Reconciled FR-2026-001", dt.date(2026, 8, 23)),
        ("efua", "create", "hr_note", PEOPLE["michael"], "Added probation review note", dt.date(2026, 10, 14)),
        ("solomon", "assign_device", "device", PEOPLE["gifty"], "Assigned Dell Latitude to Gifty Amoako", dt.date(2026, 7, 24)),
        ("william", "create", "chat_conversation", conv_ids[0], "Created Leadership Team channel", dt.date(2026, 8, 3)),
        ("kofi", "submit", "timesheet", PEOPLE["kofi"], "Submitted weekly timesheet", dt.date(2026, 10, 26)),
    ]
    for index, (actor, action, entity_type, entity_id, description, day) in enumerate(audit_specs):
        audit_rows.append(
            {
                "id": uuid.uuid4(),
                "actor_user_id": u[actor],
                "actor_person_id": PEOPLE[actor],
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_values": None,
                "new_values": json.dumps({"summary": description}),
                "metadata": json.dumps({"source": "demo_seed"}),
                "description": description,
                "ip_address": "197.251.140.10",
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "created_at": at(day, 9 + (index % 9)),
            }
        )
    await insert_many(conn, "audit_logs", audit_rows)

    return {
        "documents": len(document_inserts),
        "devices": len(device_rows),
        "device_assignments": len(assignment_rows),
        "hr_notes": len(note_inserts),
        "compensation_requests": len(comp_rows),
        "chat_conversations": len(conv_rows),
        "chat_messages": len(message_rows),
        "notifications": len(notification_rows),
        "audit_logs": len(audit_rows),
    }


COMPONENTS = {
    "BASIC": None,
    "TRANSPORT": None,
    "HOUSING": None,
    "MEDICAL": None,
}
SCHEMES = {}


async def main():
    if settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit("Refusing to seed: DATABASE_URL points at SQLite.")

    conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        if await conn.fetchval("SELECT count(*) FROM payroll_runs"):
            raise SystemExit("Payroll runs already present; aborting.")
        if await conn.fetchval("SELECT count(*) FROM budgets"):
            raise SystemExit("Budgets already present; aborting.")

        component_rows = await conn.fetch("SELECT id, code FROM payroll_component_types")
        for row in component_rows:
            COMPONENTS[row["code"]] = row["id"]
        scheme_rows = await conn.fetch("SELECT id, code FROM payroll_statutory_schemes")
        for row in scheme_rows:
            SCHEMES[row["code"]] = row["id"]

        band_rows = await conn.fetch(
            "SELECT b.band_from, b.band_to, b.rate FROM payroll_tax_bands b "
            "JOIN payroll_statutory_schemes s ON s.id = b.scheme_id "
            "WHERE s.code = 'PAYE' ORDER BY b.sequence"
        )
        bands = [
            (dec(r["band_from"]), dec(r["band_to"]) if r["band_to"] is not None else None, dec(r["rate"]))
            for r in band_rows
        ]

        group_rows = await conn.fetch("SELECT id, name FROM payroll_pay_groups")
        groups = {row["name"]: row["id"] for row in group_rows}

        profile_rows = await conn.fetch(
            """
            SELECT pr.person_id, pr.base_amount, pr.payment_method, pr.cost_center,
                   pr.pay_group_id, pr.pay_type,
                   p.first_name, p.last_name, p.employee_number, p.department,
                   ba.bank_name, ba.account_number_last4, ba.mobile_money_provider,
                   l.installment_amount
            FROM payroll_employee_profiles pr
            JOIN people p ON p.id = pr.person_id
            LEFT JOIN payroll_bank_accounts ba
                   ON ba.person_id = pr.person_id AND ba.is_primary
            LEFT JOIN payroll_loans l ON l.person_id = pr.person_id AND l.status = 'active'
            WHERE p.type = 'staff'
            ORDER BY p.employee_number
            """
        )
        staff = []
        for row in profile_rows:
            staff.append(
                {
                    "id": row["person_id"],
                    "name": f"{row['first_name']} {row['last_name']}",
                    "employee_number": row["employee_number"],
                    "department": row["department"],
                    "base_amount": row["base_amount"],
                    "payment_method": row["payment_method"],
                    "cost_center": row["cost_center"],
                    "pay_group_id": row["pay_group_id"],
                    "bank_name": row["bank_name"] or "GCB Bank",
                    "account_last4": row["account_number_last4"] or "0000",
                    "mobile_provider": row["mobile_money_provider"],
                    "loan_installment": row["installment_amount"],
                }
            )
        staff_by_group = {"Leadership": [], "Head Office": []}
        for person in staff:
            for group_name, group_id in groups.items():
                if person["pay_group_id"] == group_id:
                    staff_by_group[group_name].append(person)

        async with conn.transaction():
            payroll_summary = await seed_payroll(conn, staff, groups, staff_by_group, bands)
            finance_summary = await seed_finance(conn)
            support_summary = await seed_support(conn)

        print("payroll:", payroll_summary)
        print("finance:", finance_summary)
        print("support:", support_summary)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())

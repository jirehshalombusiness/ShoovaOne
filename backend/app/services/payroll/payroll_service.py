from __future__ import annotations

import calendar
import hashlib
import json
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.core.notification import Notification
from app.models.sql.core.user import Person, User
from app.models.sql.hr.compensation import CompensationChange
from app.models.sql.hr.employment_contract import EmploymentContract
from app.models.sql.hr.leave import LeaveRequest, LeaveType
from app.models.sql.payroll.config import (
    PayComponentType,
    PayGroup,
    PayPeriod,
    StatutoryScheme,
)
from app.models.sql.payroll.disbursement import DisbursementBatch
from app.models.sql.payroll.employee import (
    EmployeePayProfile,
    Loan,
    LoanInstallment,
    RecurringComponent,
)
from app.models.sql.payroll.payslip import Payslip
from app.models.sql.payroll.runs import (
    PayRun,
    PayRunApproval,
    PayRunItem,
    PayRunLine,
    PayRunTimesheet,
    PayrollGLEntry,
    StatutoryRemittance,
)
from app.models.sql.timekeeping.timesheet import Timesheet, TimesheetEntry
from app.services.core.audit_service import AuditService
from app.services.payroll.calculator import (
    ComponentInput,
    LoanInput,
    PayCalculationInput,
    StatutorySchemeInput,
    TaxBandInput,
    calculate_pay,
    dec,
    money,
    rate,
    working_days,
)

ZERO = Decimal("0.00")

FREQUENCY_PER_YEAR = {
    "weekly": Decimal("52"),
    "biweekly": Decimal("26"),
    "semi_monthly": Decimal("24"),
    "monthly": Decimal("12"),
    "annual": Decimal("1"),
}

FINAL_RUN_STATUSES = {
    "finalized",
    "disbursing",
    "paid",
    "closed",
}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def person_name(person: Person) -> str:
    return f"{person.first_name} {person.last_name}".strip()


def add_months(value: date, months: int) -> date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def next_remittance_due_date(pay_date: date, due_day: Optional[int]) -> date:
    if not due_day:
        return pay_date + timedelta(days=30)

    year = pay_date.year
    month = pay_date.month + 1
    if month > 12:
        month = 1
        year += 1

    day = min(due_day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


async def resolve_pay_profile(
    db: AsyncSession,
    person_id,
    on_date: date,
) -> Optional[EmployeePayProfile]:
    result = await db.execute(
        select(EmployeePayProfile)
        .options(selectinload(EmployeePayProfile.person))
        .where(
            EmployeePayProfile.person_id == person_id,
            EmployeePayProfile.is_active.is_(True),
            EmployeePayProfile.effective_from <= on_date,
            or_(
                EmployeePayProfile.effective_to.is_(None),
                EmployeePayProfile.effective_to >= on_date,
            ),
        )
        .order_by(EmployeePayProfile.effective_from.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()

    if profile:
        return profile

    fallback = await db.execute(
        select(EmployeePayProfile)
        .options(selectinload(EmployeePayProfile.person))
        .where(
            EmployeePayProfile.person_id == person_id,
            EmployeePayProfile.is_active.is_(True),
        )
        .order_by(EmployeePayProfile.effective_from.desc())
        .limit(1)
    )
    return fallback.scalar_one_or_none()


async def resolve_compensation(
    db: AsyncSession,
    person_id,
    period_start: date,
    period_end: date,
    period_frequency: str,
    fallback: Decimal,
) -> Decimal:
    result = await db.execute(
        select(CompensationChange)
        .where(
            CompensationChange.person_id == person_id,
            CompensationChange.effective_from <= period_end,
            or_(
                CompensationChange.effective_to.is_(None),
                CompensationChange.effective_to >= period_start,
            ),
        )
        .order_by(CompensationChange.effective_from.desc())
        .limit(1)
    )
    change = result.scalar_one_or_none()

    if change and change.base_amount is not None:
        source_frequency = change.frequency or "monthly"
        return convert_amount(
            dec(change.base_amount),
            source_frequency,
            period_frequency,
        )

    contract_result = await db.execute(
        select(EmploymentContract)
        .where(
            EmploymentContract.person_id == person_id,
            EmploymentContract.start_date <= period_end,
            or_(
                EmploymentContract.end_date.is_(None),
                EmploymentContract.end_date >= period_start,
            ),
        )
        .order_by(EmploymentContract.start_date.desc())
        .limit(1)
    )
    contract = contract_result.scalar_one_or_none()

    if contract and contract.compensation_amount is not None:
        return convert_amount(
            dec(contract.compensation_amount),
            contract.compensation_frequency or "monthly",
            period_frequency,
        )

    return money(fallback)


def convert_amount(
    amount: Decimal,
    source_frequency: str,
    target_frequency: str,
) -> Decimal:
    source_per_year = FREQUENCY_PER_YEAR.get(source_frequency, Decimal("12"))
    target_per_year = FREQUENCY_PER_YEAR.get(target_frequency, Decimal("12"))
    annual = amount * source_per_year
    return money(annual / target_per_year)


async def contract_window(
    db: AsyncSession,
    person_id,
    period_start: date,
    period_end: date,
) -> tuple[date, date]:
    result = await db.execute(
        select(EmploymentContract)
        .where(
            EmploymentContract.person_id == person_id,
            EmploymentContract.start_date <= period_end,
            or_(
                EmploymentContract.end_date.is_(None),
                EmploymentContract.end_date >= period_start,
            ),
        )
        .order_by(EmploymentContract.start_date.desc())
        .limit(1)
    )
    contract = result.scalar_one_or_none()

    if not contract:
        return period_start, period_end

    eligible_from = max(period_start, contract.start_date)
    eligible_to = period_end
    if contract.end_date:
        eligible_to = min(period_end, contract.end_date)

    return eligible_from, eligible_to


async def aggregate_timesheets(
    db: AsyncSession,
    person_id,
    period: PayPeriod,
) -> dict:
    cutoff = period.cutoff_at
    if cutoff is None:
        cutoff = datetime.combine(
            period.period_end,
            time.max,
            tzinfo=timezone.utc,
        )

    query = (
        select(Timesheet)
        .options(selectinload(Timesheet.entries))
        .where(
            Timesheet.person_id == person_id,
            Timesheet.status == "approved",
            Timesheet.week_end_date >= period.period_start,
            Timesheet.week_start_date <= period.period_end,
            or_(
                Timesheet.approved_at.is_(None),
                Timesheet.approved_at <= cutoff,
            ),
        )
    )

    result = await db.execute(query)
    timesheets = list(result.scalars().all())

    regular_hours = ZERO
    overtime_hours = ZERO
    used: list[dict] = []

    for sheet in timesheets:
        sheet_regular = ZERO
        sheet_overtime = ZERO

        for entry in sheet.entries:
            if entry.date < period.period_start or entry.date > period.period_end:
                continue

            duration = dec(entry.duration)
            overtime = ZERO

            if entry.overtime_minutes and entry.overtime_minutes > 0:
                overtime = dec(entry.overtime_minutes) / Decimal("60")
            elif entry.is_overtime:
                overtime = duration

            overtime = min(max(overtime, ZERO), duration)
            sheet_regular += duration - overtime
            sheet_overtime += overtime

        regular_hours += sheet_regular
        overtime_hours += sheet_overtime

        used.append(
            {
                "timesheet_id": str(sheet.id),
                "week_start_date": sheet.week_start_date,
                "week_end_date": sheet.week_end_date,
                "total_hours": money(sheet_regular + sheet_overtime),
                "overtime_hours": money(sheet_overtime),
            }
        )

    return {
        "regular_hours": dec(regular_hours),
        "overtime_hours": dec(overtime_hours),
        "timesheets": used,
    }


async def unpaid_leave_days(
    db: AsyncSession,
    person_id,
    period_start: date,
    period_end: date,
) -> Decimal:
    result = await db.execute(
        select(LeaveRequest, LeaveType)
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .where(
            LeaveRequest.person_id == person_id,
            LeaveRequest.status == "approved",
            LeaveType.is_paid.is_(False),
            LeaveRequest.start_date <= period_end,
            LeaveRequest.end_date >= period_start,
        )
    )

    total = 0
    for leave, _leave_type in result.all():
        overlap_start = max(period_start, leave.start_date)
        overlap_end = min(period_end, leave.end_date)
        total += working_days(overlap_start, overlap_end)

    return dec(total)


async def load_statutory_schemes(
    db: AsyncSession,
    on_date: date,
) -> list[StatutorySchemeInput]:
    result = await db.execute(
        select(StatutoryScheme)
        .options(selectinload(StatutoryScheme.bands))
        .where(
            StatutoryScheme.is_active.is_(True),
            StatutoryScheme.effective_from <= on_date,
            or_(
                StatutoryScheme.effective_to.is_(None),
                StatutoryScheme.effective_to >= on_date,
            ),
        )
        .order_by(StatutoryScheme.priority)
    )

    schemes = []
    for scheme in result.scalars().all():
        bands = tuple(
            TaxBandInput(
                band_from=dec(band.band_from),
                band_to=dec(band.band_to) if band.band_to is not None else None,
                rate=dec(band.rate),
            )
            for band in scheme.bands
        )
        schemes.append(
            StatutorySchemeInput(
                id=str(scheme.id),
                code=scheme.code,
                name=scheme.name,
                scheme_type=scheme.scheme_type,
                employee_rate=dec(scheme.employee_rate),
                employer_rate=dec(scheme.employer_rate),
                base=scheme.base,
                cap=dec(scheme.cap) if scheme.cap is not None else None,
                relief_amount=dec(scheme.relief_amount),
                priority=scheme.priority or 100,
                bands=bands,
            )
        )

    return schemes


async def load_recurring_components(
    db: AsyncSession,
    person_id,
    on_date: date,
) -> tuple[list[ComponentInput], list[ComponentInput], list[ComponentInput]]:
    result = await db.execute(
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(
            RecurringComponent.person_id == person_id,
            RecurringComponent.is_active.is_(True),
            RecurringComponent.effective_from <= on_date,
            or_(
                RecurringComponent.effective_to.is_(None),
                RecurringComponent.effective_to >= on_date,
            ),
        )
    )

    earnings: list[ComponentInput] = []
    deductions: list[ComponentInput] = []
    employer_contributions: list[ComponentInput] = []

    for component in result.scalars().all():
        component_type = component.component_type
        if not component_type or not component_type.is_active:
            continue
        if component_type.statutory:
            continue

        if component_type.calculation == "fixed":
            amount = dec(component.amount)
            if amount <= ZERO:
                amount = dec(component_type.default_amount)
            if (
                component.remaining_amount is not None
                and component_type.category == "employee_deduction"
            ):
                amount = min(amount, dec(component.remaining_amount))
        else:
            amount = ZERO

        if component_type.calculation == "fixed" and amount <= ZERO:
            continue

        item = ComponentInput(
            code=component_type.code,
            name=component_type.name,
            amount=amount,
            rate=dec(component.rate or component_type.default_rate),
            category=component_type.category,
            taxable=component_type.taxable,
            statutory=component_type.statutory,
            calculation=component_type.calculation,
            calculation_base=component_type.calculation_base,
            priority=component_type.priority or 100,
            component_type_id=str(component_type.id),
            source="recurring",
            source_ref=str(component.id),
        )

        if component_type.category == "earning":
            earnings.append(item)
        elif component_type.category == "employer_contribution":
            employer_contributions.append(item)
        elif component_type.category == "employee_deduction":
            deductions.append(item)

    return earnings, deductions, employer_contributions


async def load_loans(db: AsyncSession, person_id) -> list[LoanInput]:
    result = await db.execute(
        select(Loan).where(
            Loan.person_id == person_id,
            Loan.status == "active",
            Loan.outstanding_balance > 0,
        )
    )

    loans = []
    for loan in result.scalars().all():
        installment = min(
            dec(loan.installment_amount),
            dec(loan.outstanding_balance),
        )
        if installment <= ZERO:
            continue
        loans.append(
            LoanInput(
                id=str(loan.id),
                name=f"Staff loan repayment ({money(dec(loan.principal))})",
                installment_amount=installment,
                outstanding_balance=dec(loan.outstanding_balance),
                priority=30,
            )
        )

    return loans


async def build_calculation_input(
    db: AsyncSession,
    profile: EmployeePayProfile,
    period: PayPeriod,
    group: PayGroup,
) -> tuple[PayCalculationInput, dict]:
    person = profile.person
    pay_date = period.pay_date

    eligible_from, eligible_to = await contract_window(
        db,
        profile.person_id,
        period.period_start,
        period.period_end,
    )

    compensation = await resolve_compensation(
        db,
        profile.person_id,
        period.period_start,
        period.period_end,
        period.frequency,
        dec(profile.base_amount),
    )

    hours = await aggregate_timesheets(db, profile.person_id, period)
    leave_days = await unpaid_leave_days(
        db,
        profile.person_id,
        period.period_start,
        period.period_end,
    )
    earnings, deductions, employer_contributions = await load_recurring_components(
        db,
        profile.person_id,
        pay_date,
    )
    schemes = await load_statutory_schemes(db, pay_date)
    loans = await load_loans(db, profile.person_id)

    pay_type = profile.pay_type or "salaried"
    raw_regular_hours = dec(hours["regular_hours"])
    raw_overtime_hours = dec(hours["overtime_hours"])

    hourly_rate_value = dec(profile.hourly_rate)
    if hourly_rate_value <= ZERO and pay_type in {"salaried", "mixed"}:
        period_working_days = working_days(period.period_start, period.period_end)
        if period_working_days > 0:
            hourly_rate_value = rate(
                compensation
                / dec(period_working_days)
                / dec(8)
            )

    if pay_type == "hourly":
        payable_regular_hours = raw_regular_hours
    elif pay_type == "mixed" and dec(profile.hourly_rate) > ZERO:
        payable_regular_hours = raw_regular_hours
    else:
        payable_regular_hours = ZERO

    payload = PayCalculationInput(
        pay_type=pay_type,
        base_amount=compensation,
        hourly_rate=hourly_rate_value,
        overtime_multiplier=dec(profile.overtime_multiplier),
        currency=profile.currency or group.currency,
        period_start=period.period_start,
        period_end=period.period_end,
        pay_date=pay_date,
        proration_basis=group.proration_basis,
        overtime_eligible=bool(group.overtime_eligible),
        eligible_from=eligible_from,
        eligible_to=eligible_to,
        regular_hours=payable_regular_hours,
        overtime_hours=raw_overtime_hours,
        unpaid_leave_days=leave_days,
        earnings=earnings,
        deductions=deductions,
        employer_contributions=employer_contributions,
        statutory_schemes=schemes,
        loans=loans,
    )

    snapshot = {
        "person_name": person_name(person) if person else "",
        "employee_number": person.employee_number if person else None,
        "department": profile.department or (person.department if person else None),
        "cost_center": profile.cost_center,
        "resolved_base": str(compensation),
        "eligible_from": eligible_from.isoformat(),
        "eligible_to": eligible_to.isoformat(),
        "regular_hours": str(raw_regular_hours),
        "overtime_hours": str(raw_overtime_hours),
        "payable_hourly_rate": str(hourly_rate_value),
        "timesheets": hours["timesheets"],
        "unpaid_leave_days": str(leave_days),
    }

    return payload, snapshot


async def load_run(
    db: AsyncSession,
    run_id: str,
    include_items: bool = True,
) -> PayRun:
    query = (
        select(PayRun)
        .options(
            selectinload(PayRun.period),
            selectinload(PayRun.pay_group),
            selectinload(PayRun.approvals),
        )
    )

    if include_items:
        query = query.options(
            selectinload(PayRun.items).selectinload(PayRunItem.lines)
        )

    result = await db.execute(
        query.where(PayRun.id == run_id).execution_options(populate_existing=True)
    )
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Pay run not found")

    return run


def line_to_dict(line: PayRunLine) -> dict:
    return {
        "id": str(line.id),
        "code": line.code,
        "name": line.name,
        "category": line.category,
        "quantity": line.quantity,
        "rate": line.rate,
        "amount": line.amount,
        "taxable": line.taxable,
        "statutory": line.statutory,
        "employer": line.employer,
        "source": line.source,
        "source_ref": line.source_ref,
        "priority": line.priority,
        "notes": line.notes,
    }


def item_to_dict(item: PayRunItem, include_lines: bool = True) -> dict:
    payload = {
        "id": str(item.id),
        "person_id": str(item.person_id),
        "person_name": item.person_name,
        "employee_number": item.employee_number,
        "department": item.department,
        "cost_center": item.cost_center,
        "pay_type": item.pay_type,
        "currency": item.currency,
        "regular_hours": item.regular_hours,
        "overtime_hours": item.overtime_hours,
        "unpaid_leave_days": item.unpaid_leave_days,
        "gross_pay": item.gross_pay,
        "total_employee_deductions": item.total_employee_deductions,
        "total_employer_contributions": item.total_employer_contributions,
        "net_pay": item.net_pay,
        "employer_cost": item.employer_cost,
        "status": item.status,
        "exception_summary": item.exception_summary,
    }

    if include_lines:
        payload["lines"] = [line_to_dict(line) for line in item.lines]

    return payload


def run_to_dict(run: PayRun, include_items: bool = False) -> dict:
    payload = {
        "id": str(run.id),
        "run_number": run.run_number,
        "period_id": str(run.period_id),
        "pay_group_id": str(run.pay_group_id),
        "period_name": run.period.name if run.period else None,
        "pay_group_name": run.pay_group.name if run.pay_group else None,
        "run_type": run.run_type,
        "status": run.status,
        "currency": run.currency,
        "total_gross": run.total_gross,
        "total_employee_deductions": run.total_employee_deductions,
        "total_employer_contributions": run.total_employer_contributions,
        "total_net": run.total_net,
        "total_employer_cost": run.total_employer_cost,
        "employee_count": run.employee_count,
        "exception_count": run.exception_count,
        "prepared_by_id": str(run.prepared_by_id) if run.prepared_by_id else None,
        "hr_approved_by_id": str(run.hr_approved_by_id) if run.hr_approved_by_id else None,
        "hr_approved_at": run.hr_approved_at,
        "finance_approved_by_id": str(run.finance_approved_by_id) if run.finance_approved_by_id else None,
        "finance_approved_at": run.finance_approved_at,
        "approved_by_id": str(run.approved_by_id) if run.approved_by_id else None,
        "approved_at": run.approved_at,
        "finalized_at": run.finalized_at,
        "paid_at": run.paid_at,
        "notes": run.notes,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
        "approvals": [
            {
                "id": str(approval.id),
                "stage": approval.stage,
                "decision": approval.decision,
                "actor_person_id": (
                    str(approval.actor_person_id)
                    if approval.actor_person_id
                    else None
                ),
                "note": approval.note,
                "decided_at": approval.decided_at,
            }
            for approval in (run.approvals or [])
        ],
    }

    if include_items:
        payload["items"] = [
            item_to_dict(item) for item in (run.items or [])
        ]

    return payload


class PayrollService:
    @staticmethod
    async def create_run(
        db: AsyncSession,
        *,
        period_id: str,
        pay_group_id: str,
        run_type: str,
        actor: User,
        notes: Optional[str] = None,
    ) -> PayRun:
        period_result = await db.execute(
            select(PayPeriod).where(PayPeriod.id == period_id)
        )
        period = period_result.scalar_one_or_none()
        if not period:
            raise HTTPException(status_code=404, detail="Pay period not found")

        group_result = await db.execute(
            select(PayGroup).where(PayGroup.id == pay_group_id)
        )
        group = group_result.scalar_one_or_none()
        if not group:
            raise HTTPException(status_code=404, detail="Pay group not found")

        existing_result = await db.execute(
            select(PayRun).where(
                PayRun.period_id == period_id,
                PayRun.pay_group_id == pay_group_id,
                PayRun.run_type == run_type,
                PayRun.status.not_in(["cancelled", "reversed"]),
            )
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An active pay run already exists for this period, "
                    "pay group and run type."
                ),
            )

        run = PayRun(
            id=str(uuid.uuid4()),
            period_id=period_id,
            pay_group_id=pay_group_id,
            run_type=run_type,
            status="draft",
            currency=group.currency,
            prepared_by_id=actor.person_id,
            notes=notes,
        )
        db.add(run)
        await db.flush()

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_RUN_CREATED",
            entity_type="pay_run",
            entity_id=run.id,
            description=f"Created {run_type} pay run for {period.name}",
            new_values={"period_id": period_id, "pay_group_id": pay_group_id},
        )

        await db.commit()

        return await load_run(db, str(run.id))

    @staticmethod
    async def calculate_run(
        db: AsyncSession,
        *,
        run_id: str,
        actor: User,
    ) -> PayRun:
        run = await load_run(db, run_id)

        if run.status not in {"draft", "calculated"}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "A pay run can only be recalculated before it is sent "
                    f"to Finance (current status: {run.status})."
                ),
            )

        for item in list(run.items):
            await db.delete(item)
        await db.execute(
            delete(PayRunTimesheet).where(PayRunTimesheet.run_id == run.id)
        )
        await db.execute(
            delete(PayRunApproval).where(PayRunApproval.run_id == run.id)
        )
        await db.flush()

        profiles_result = await db.execute(
            select(EmployeePayProfile)
            .options(
                selectinload(EmployeePayProfile.person),
                selectinload(EmployeePayProfile.pay_group),
            )
            .where(
                EmployeePayProfile.pay_group_id == run.pay_group_id,
                EmployeePayProfile.is_active.is_(True),
                EmployeePayProfile.effective_from <= run.period.period_end,
                or_(
                    EmployeePayProfile.effective_to.is_(None),
                    EmployeePayProfile.effective_to >= run.period.period_start,
                ),
            )
            .order_by(
                EmployeePayProfile.person_id,
                EmployeePayProfile.effective_from.desc(),
            )
        )

        profiles: list[EmployeePayProfile] = []
        seen_people: set[str] = set()
        for profile in profiles_result.scalars().all():
            key = str(profile.person_id)
            if key in seen_people:
                continue
            seen_people.add(key)
            profiles.append(profile)

        total_gross = ZERO
        total_employee_deductions = ZERO
        total_employer_contributions = ZERO
        total_net = ZERO
        total_employer_cost = ZERO
        exception_count = 0
        item_count = 0
        hash_parts: list[str] = []

        for profile in profiles:
            person = profile.person
            if not person or person.deleted_at is not None:
                continue

            try:
                payload, snapshot = await build_calculation_input(
                    db,
                    profile,
                    run.period,
                    run.pay_group,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Failed to prepare pay for {person_name(person)}: {exc}"
                    ),
                ) from exc

            result = calculate_pay(payload)
            hash_parts.append(result.input_hash)

            item = PayRunItem(
                id=str(uuid.uuid4()),
                run_id=run.id,
                person_id=person.id,
                person_name=person_name(person),
                employee_number=person.employee_number,
                department=snapshot["department"],
                cost_center=snapshot["cost_center"],
                pay_type=profile.pay_type,
                currency=payload.currency,
                regular_hours=money(dec(snapshot["regular_hours"])),
                overtime_hours=money(dec(snapshot["overtime_hours"])),
                unpaid_leave_days=money(payload.unpaid_leave_days),
                gross_pay=result.gross_pay,
                total_employee_deductions=result.total_employee_deductions,
                total_employer_contributions=result.total_employer_contributions,
                net_pay=result.net_pay,
                employer_cost=result.employer_cost,
                status="held" if result.held else "calculated",
                exception_summary=(
                    "\n".join(result.exceptions)
                    if result.exceptions
                    else None
                ),
                calculation_snapshot=json.dumps(
                    {
                        **snapshot,
                        "input_hash": result.input_hash,
                        "basic_pay": str(result.basic_pay),
                        "taxable_gross": str(result.taxable_gross),
                    },
                    default=str,
                ),
            )
            db.add(item)
            await db.flush()

            for line in result.lines:
                db.add(
                    PayRunLine(
                        id=str(uuid.uuid4()),
                        run_item_id=item.id,
                        component_type_id=line.component_type_id,
                        code=line.code,
                        name=line.name,
                        category=line.category,
                        quantity=line.quantity,
                        rate=line.rate,
                        amount=money(line.amount),
                        taxable="yes" if line.taxable else "no",
                        statutory="yes" if line.statutory else "no",
                        employer="yes" if line.employer else "no",
                        source=line.source,
                        source_ref=line.source_ref,
                        priority=line.priority,
                        notes=line.notes,
                    )
                )

            for sheet in snapshot["timesheets"]:
                db.add(
                    PayRunTimesheet(
                        id=str(uuid.uuid4()),
                        run_id=run.id,
                        timesheet_id=sheet["timesheet_id"],
                        person_id=person.id,
                        week_start_date=sheet["week_start_date"],
                        week_end_date=sheet["week_end_date"],
                        total_hours=sheet["total_hours"],
                        overtime_hours=sheet["overtime_hours"],
                        locked_at=utcnow(),
                    )
                )

            total_gross += result.gross_pay
            total_employee_deductions += result.total_employee_deductions
            total_employer_contributions += result.total_employer_contributions
            total_net += result.net_pay
            total_employer_cost += result.employer_cost
            item_count += 1
            if result.exceptions:
                exception_count += 1

        run.total_gross = money(total_gross)
        run.total_employee_deductions = money(total_employee_deductions)
        run.total_employer_contributions = money(total_employer_contributions)
        run.total_net = money(total_net)
        run.total_employer_cost = money(total_employer_cost)
        run.employee_count = item_count
        run.exception_count = exception_count
        run.status = "calculated"
        run.calculation_hash = hashlib.sha256(
            "|".join(sorted(hash_parts)).encode("utf-8")
        ).hexdigest()

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_RUN_CALCULATED",
            entity_type="pay_run",
            entity_id=run.id,
            description=(
                f"Calculated {run.employee_count} employees; "
                f"net {run.currency} {run.total_net}"
            ),
            new_values={
                "total_gross": str(run.total_gross),
                "total_net": str(run.total_net),
                "exception_count": run.exception_count,
            },
        )

        await db.commit()

        return await load_run(db, run_id)

    @staticmethod
    async def submit_to_finance(
        db: AsyncSession,
        *,
        run_id: str,
        actor: User,
        note: Optional[str] = None,
    ) -> PayRun:
        run = await load_run(db, run_id)

        if run.status != "calculated":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only a calculated run can be submitted to Finance "
                    f"(current status: {run.status})."
                ),
            )

        if run.employee_count <= 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The pay run has no employees to pay.",
            )

        held_items = [item for item in run.items if item.status == "held"]
        if held_items:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{len(held_items)} pay item(s) are on hold because of "
                    "calculation errors. Resolve them before submitting to Finance."
                ),
            )

        run.status = "hr_approved"
        run.hr_approved_by_id = actor.person_id
        run.hr_approved_at = utcnow()

        db.add(
            PayRunApproval(
                id=str(uuid.uuid4()),
                run_id=run.id,
                stage="hr",
                decision="submitted",
                actor_person_id=actor.person_id,
                note=note,
                decided_at=utcnow(),
            )
        )

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_RUN_SUBMITTED_TO_FINANCE",
            entity_type="pay_run",
            entity_id=run.id,
            description=f"Submitted pay run to Finance ({run.id})",
            new_values={"status": run.status, "note": note},
        )

        await db.commit()
        return await load_run(db, run_id)

    @staticmethod
    async def review_finance(
        db: AsyncSession,
        *,
        run_id: str,
        actor: User,
        decision: str,
        note: Optional[str] = None,
    ) -> PayRun:
        run = await load_run(db, run_id)

        if run.status != "hr_approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Finance can only review a run submitted by HR "
                    f"(current status: {run.status})."
                ),
            )

        if actor.person_id and str(actor.person_id) == str(run.prepared_by_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Segregation of duties: the person who prepared the run "
                    "cannot approve the Finance stage."
                ),
            )

        if (
            actor.person_id
            and run.hr_approved_by_id
            and str(actor.person_id) == str(run.hr_approved_by_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Segregation of duties: the person who signed off the "
                    "run for HR cannot also review it at Finance."
                ),
            )

        if decision not in {"approved", "returned"}:
            raise HTTPException(status_code=400, detail="Invalid decision")

        db.add(
            PayRunApproval(
                id=str(uuid.uuid4()),
                run_id=run.id,
                stage="finance",
                decision=decision,
                actor_person_id=actor.person_id,
                note=note,
                decided_at=utcnow(),
            )
        )

        if decision == "returned":
            run.status = "calculated"
            run.finance_approved_by_id = None
            run.finance_approved_at = None
        else:
            run.status = "finance_approved"
            run.finance_approved_by_id = actor.person_id
            run.finance_approved_at = utcnow()

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_FINANCE_REVIEWED",
            entity_type="pay_run",
            entity_id=run.id,
            description=f"Finance {decision} pay run {run.id}",
            new_values={"status": run.status, "note": note},
        )

        await db.commit()
        return await load_run(db, run_id)

    @staticmethod
    async def final_approve(
        db: AsyncSession,
        *,
        run_id: str,
        actor: User,
        note: Optional[str] = None,
    ) -> PayRun:
        run = await load_run(db, run_id)

        if run.status != "finance_approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Final approval requires a Finance-approved run "
                    f"(current status: {run.status})."
                ),
            )

        if actor.person_id and str(actor.person_id) == str(run.prepared_by_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Segregation of duties: preparer cannot give final approval.",
            )

        if (
            actor.person_id
            and str(actor.person_id) == str(run.finance_approved_by_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Segregation of duties: Finance approver and final "
                    "approver must be different people."
                ),
            )

        run.status = "approved"
        run.approved_by_id = actor.person_id
        run.approved_at = utcnow()

        db.add(
            PayRunApproval(
                id=str(uuid.uuid4()),
                run_id=run.id,
                stage="final",
                decision="approved",
                actor_person_id=actor.person_id,
                note=note,
                decided_at=utcnow(),
            )
        )

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_RUN_APPROVED",
            entity_type="pay_run",
            entity_id=run.id,
            description=f"Final approval for pay run {run.id}",
            new_values={"status": run.status},
        )

        await db.commit()
        return await load_run(db, run_id)

    @staticmethod
    async def finalize(
        db: AsyncSession,
        *,
        run_id: str,
        actor: User,
    ) -> PayRun:
        run = await load_run(db, run_id)

        if run.status in FINAL_RUN_STATUSES:
            return run

        if run.status != "approved":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Only an approved run can be finalized "
                    f"(current status: {run.status})."
                ),
            )

        held_items = [item for item in run.items if item.status == "held"]
        if held_items:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"{len(held_items)} pay item(s) are on hold and cannot "
                    "be finalized."
                ),
            )

        now = utcnow()
        run.run_number = (
            f"PR-{run.period.period_start.strftime('%Y%m')}-"
            f"{run.pay_group.name[:4].upper()}-{uuid.uuid4().hex[:6].upper()}"
        )
        run.status = "finalized"
        run.finalized_at = now

        salary_by_cost_center: dict[str, Decimal] = {}
        employer_by_cost_center: dict[str, Decimal] = {}
        net_total = ZERO
        statutory_employee_total = ZERO
        statutory_employer_total = ZERO
        loan_total = ZERO
        other_deduction_total = ZERO
        other_employer_total = ZERO
        scheme_totals: dict[str, dict] = {}

        for item in run.items:
            if item.status == "cancelled":
                continue

            cost_center = item.cost_center or "Unassigned"
            salary_by_cost_center[cost_center] = (
                salary_by_cost_center.get(cost_center, ZERO) + dec(item.gross_pay)
            )
            employer_by_cost_center[cost_center] = (
                employer_by_cost_center.get(cost_center, ZERO)
                + dec(item.total_employer_contributions)
            )
            net_total += dec(item.net_pay)

            for line in item.lines:
                if line.statutory == "yes" and line.source_ref:
                    bucket = scheme_totals.setdefault(
                        line.source_ref,
                        {
                            "employee": ZERO,
                            "employer": ZERO,
                        },
                    )
                    if line.category == "employee_deduction":
                        bucket["employee"] += dec(line.amount)
                        statutory_employee_total += dec(line.amount)
                    elif line.category == "employer_contribution":
                        bucket["employer"] += dec(line.amount)
                        statutory_employer_total += dec(line.amount)

                if (
                    line.category == "employer_contribution"
                    and line.statutory != "yes"
                ):
                    other_employer_total += dec(line.amount)

                if line.category != "employee_deduction":
                    continue

                if line.source == "loan":
                    loan_total += dec(line.amount)
                elif line.statutory != "yes":
                    other_deduction_total += dec(line.amount)

            prior_result = await db.execute(
                select(
                    func.coalesce(func.sum(Payslip.gross_pay), 0),
                    func.coalesce(func.sum(Payslip.total_deductions), 0),
                    func.coalesce(func.sum(Payslip.net_pay), 0),
                )
                .join(PayPeriod, Payslip.period_id == PayPeriod.id)
                .where(
                    Payslip.person_id == item.person_id,
                    Payslip.status == "issued",
                    PayPeriod.pay_date < run.period.pay_date,
                )
            )
            prior_gross, prior_deductions, prior_net = prior_result.one()

            db.add(
                Payslip(
                    id=str(uuid.uuid4()),
                    run_item_id=item.id,
                    person_id=item.person_id,
                    period_id=run.period_id,
                    gross_pay=item.gross_pay,
                    total_deductions=item.total_employee_deductions,
                    net_pay=item.net_pay,
                    ytd_gross=money(dec(prior_gross) + dec(item.gross_pay)),
                    ytd_deductions=money(
                        dec(prior_deductions)
                        + dec(item.total_employee_deductions)
                    ),
                    ytd_net=money(dec(prior_net) + dec(item.net_pay)),
                    status="issued",
                    version=1,
                    issued_at=now,
                )
            )

            await PayrollService._apply_loan_repayments(
                db,
                item,
                now,
                run.period.pay_date,
            )
            await PayrollService._apply_recurring_balance(db, item)

        # ----------------------------------------------------
        # General ledger
        # ----------------------------------------------------
        for cost_center, amount in salary_by_cost_center.items():
            if amount == ZERO:
                continue
            db.add(
                PayrollGLEntry(
                    id=str(uuid.uuid4()),
                    run_id=run.id,
                    entry_date=run.period.pay_date,
                    account_code="6100",
                    account_name="Salaries and wages",
                    description=f"Payroll {run.run_number}",
                    cost_center=cost_center,
                    debit=money(amount),
                    credit=ZERO,
                    status="posted",
                    posted_at=now,
                )
            )

        for cost_center, amount in employer_by_cost_center.items():
            if amount == ZERO:
                continue
            db.add(
                PayrollGLEntry(
                    id=str(uuid.uuid4()),
                    run_id=run.id,
                    entry_date=run.period.pay_date,
                    account_code="6110",
                    account_name="Employer statutory contributions",
                    description=f"Payroll {run.run_number}",
                    cost_center=cost_center,
                    debit=money(amount),
                    credit=ZERO,
                    status="posted",
                    posted_at=now,
                )
            )

        credits = [
            (
                "2200",
                "Net pay payable",
                net_total,
                "Employee net pay",
            ),
            (
                "2210",
                "Statutory payables",
                statutory_employee_total + statutory_employer_total,
                "PAYE, social security and other statutory liabilities",
            ),
            (
                "1300",
                "Staff loans receivable",
                loan_total,
                "Staff loan repayments",
            ),
            (
                "2220",
                "Other payroll deductions payable",
                other_deduction_total,
                "Voluntary and other deductions",
            ),
            (
                "2230",
                "Other employer contributions payable",
                other_employer_total,
                "Non-statutory employer contributions",
            ),
        ]

        for code, name, amount, description in credits:
            if amount == ZERO:
                continue
            db.add(
                PayrollGLEntry(
                    id=str(uuid.uuid4()),
                    run_id=run.id,
                    entry_date=run.period.pay_date,
                    account_code=code,
                    account_name=name,
                    description=f"{description} - {run.run_number}",
                    cost_center=None,
                    debit=ZERO,
                    credit=money(amount),
                    status="posted",
                    posted_at=now,
                )
            )

        # ----------------------------------------------------
        # Statutory remittances
        # ----------------------------------------------------
        if scheme_totals:
            schemes_result = await db.execute(
                select(StatutoryScheme).where(
                    StatutoryScheme.id.in_(list(scheme_totals.keys()))
                )
            )
            schemes = {
                str(scheme.id): scheme
                for scheme in schemes_result.scalars().all()
            }

            for scheme_id, totals in scheme_totals.items():
                scheme = schemes.get(scheme_id)
                if not scheme:
                    continue

                employee_amount = money(totals["employee"])
                employer_amount = money(totals["employer"])
                if employee_amount == ZERO and employer_amount == ZERO:
                    continue

                db.add(
                    StatutoryRemittance(
                        id=str(uuid.uuid4()),
                        run_id=run.id,
                        scheme_id=scheme.id,
                        scheme_name=scheme.name,
                        employee_amount=employee_amount,
                        employer_amount=employer_amount,
                        total_amount=money(employee_amount + employer_amount),
                        due_date=next_remittance_due_date(
                            run.period.pay_date,
                            scheme.remittance_due_day,
                        ),
                        status="pending",
                    )
                )

        # ----------------------------------------------------
        # Lock consumed timesheets and notify employees
        # ----------------------------------------------------
        links_result = await db.execute(
            select(PayRunTimesheet).where(PayRunTimesheet.run_id == run.id)
        )
        for link in links_result.scalars().all():
            await db.execute(
                update(TimesheetEntry)
                .where(
                    TimesheetEntry.timesheet_id == link.timesheet_id,
                    TimesheetEntry.date >= run.period.period_start,
                    TimesheetEntry.date <= run.period.period_end,
                )
                .values(is_locked=True)
            )

        for item in run.items:
            if item.status == "cancelled":
                continue
            await PayrollService._notify_person(
                db,
                person_id=item.person_id,
                title="Payslip ready",
                body=(
                    f"Your payslip for {run.period.name} is available."
                ),
                link="/me/payslips",
                notification_type="payroll",
            )

        await AuditService.log(
            db=db,
            actor=actor,
            action="PAYROLL_RUN_FINALIZED",
            entity_type="pay_run",
            entity_id=run.id,
            description=f"Finalized pay run {run.run_number}",
            new_values={
                "run_number": run.run_number,
                "total_net": str(run.total_net),
                "employee_count": run.employee_count,
            },
        )

        await db.commit()
        return await load_run(db, run_id)

    @staticmethod
    async def _apply_loan_repayments(
        db: AsyncSession,
        item: PayRunItem,
        now: datetime,
        pay_date: date,
    ) -> None:
        loan_lines = [
            line
            for line in item.lines
            if line.category == "employee_deduction"
            and line.source == "loan"
            and line.source_ref
            and dec(line.amount) > ZERO
        ]

        for line in loan_lines:
            loan_result = await db.execute(
                select(Loan).where(Loan.id == line.source_ref)
            )
            loan = loan_result.scalar_one_or_none()
            if not loan:
                continue

            applied = min(dec(line.amount), dec(loan.outstanding_balance))
            if applied <= ZERO:
                continue

            installment_result = await db.execute(
                select(LoanInstallment)
                .where(
                    LoanInstallment.loan_id == loan.id,
                    LoanInstallment.status.in_(["pending", "partial"]),
                )
                .order_by(LoanInstallment.sequence)
                .limit(1)
            )
            installment = installment_result.scalar_one_or_none()

            if installment:
                original_amount = dec(installment.amount)
                installment.amount = money(applied)
                installment.principal_portion = money(applied)
                installment.interest_portion = ZERO
                installment.status = (
                    "paid" if applied >= original_amount else "partial"
                )
                installment.pay_run_item_id = item.id
                installment.paid_at = now
            else:
                sequence_result = await db.execute(
                    select(func.coalesce(func.max(LoanInstallment.sequence), 0)).where(
                        LoanInstallment.loan_id == loan.id
                    )
                )
                sequence = int(sequence_result.scalar() or 0) + 1
                db.add(
                    LoanInstallment(
                        id=str(uuid.uuid4()),
                        loan_id=loan.id,
                        sequence=sequence,
                        due_date=pay_date,
                        amount=money(applied),
                        principal_portion=money(applied),
                        interest_portion=ZERO,
                        status="paid",
                        pay_run_item_id=item.id,
                        paid_at=now,
                    )
                )

            loan.outstanding_balance = money(
                dec(loan.outstanding_balance) - applied
            )
            if dec(loan.outstanding_balance) <= ZERO:
                loan.outstanding_balance = ZERO
                loan.status = "paid"

    @staticmethod
    async def _apply_recurring_balance(
        db: AsyncSession,
        item: PayRunItem,
    ) -> None:
        lines = [
            line
            for line in item.lines
            if line.category == "employee_deduction"
            and line.source == "recurring"
            and line.source_ref
            and dec(line.amount) > ZERO
        ]

        for line in lines:
            result = await db.execute(
                select(RecurringComponent).where(
                    RecurringComponent.id == line.source_ref
                )
            )
            component = result.scalar_one_or_none()
            if not component or component.remaining_amount is None:
                continue

            remaining = dec(component.remaining_amount) - dec(line.amount)
            component.remaining_amount = money(max(remaining, ZERO))
            if dec(component.remaining_amount) <= ZERO:
                component.remaining_amount = ZERO
                component.is_active = False

    @staticmethod
    async def _notify_person(
        db: AsyncSession,
        *,
        person_id,
        title: str,
        body: Optional[str] = None,
        link: Optional[str] = None,
        notification_type: str = "info",
    ) -> None:
        user_result = await db.execute(
            select(User).where(
                User.person_id == person_id,
                User.is_active.is_(True),
            )
        )
        user = user_result.scalar_one_or_none()
        if not user:
            return

        db.add(
            Notification(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title=title,
                body=body,
                type=notification_type,
                link=link,
            )
        )

    @staticmethod
    async def list_payslips(
        db: AsyncSession,
        person_id,
    ) -> list[Payslip]:
        result = await db.execute(
            select(Payslip)
            .options(
                selectinload(Payslip.period),
                selectinload(Payslip.item).selectinload(PayRunItem.lines),
            )
            .where(Payslip.person_id == person_id)
            .order_by(Payslip.issued_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    def payslip_to_dict(payslip: Payslip, include_lines: bool = False) -> dict:
        payload = {
            "id": str(payslip.id),
            "run_item_id": str(payslip.run_item_id),
            "person_id": str(payslip.person_id),
            "period_id": str(payslip.period_id),
            "period_name": payslip.period.name if payslip.period else None,
            "gross_pay": payslip.gross_pay,
            "total_deductions": payslip.total_deductions,
            "net_pay": payslip.net_pay,
            "ytd_gross": payslip.ytd_gross,
            "ytd_deductions": payslip.ytd_deductions,
            "ytd_net": payslip.ytd_net,
            "status": payslip.status,
            "version": payslip.version,
            "issued_at": payslip.issued_at,
            "viewed_at": payslip.viewed_at,
        }
        if include_lines:
            payload["lines"] = [
                line_to_dict(line) for line in (payslip.item.lines if payslip.item else [])
            ]
        return payload

    @staticmethod
    async def mark_payslip_viewed(
        db: AsyncSession,
        *,
        payslip_id: str,
        person_id,
    ) -> Payslip:
        result = await db.execute(
            select(Payslip).where(
                Payslip.id == payslip_id,
                Payslip.person_id == person_id,
            )
        )
        payslip = result.scalar_one_or_none()
        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found")

        if payslip.viewed_at is None:
            payslip.viewed_at = utcnow()
            await db.commit()

        return payslip

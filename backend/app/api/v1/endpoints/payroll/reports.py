from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_permission
from app.models.sql.payroll.employee import Loan
from app.models.sql.payroll.runs import (
    PayRun,
    PayRunItem,
    StatutoryRemittance,
)
from app.models.sql.payroll.config import PayPeriod
from app.services.payroll.calculator import dec, money
from app.services.payroll.payroll_service import FINAL_RUN_STATUSES, run_to_dict

router = APIRouter()

reports_access = require_permission(Permissions.PAYROLL_REPORTS)

ZERO = Decimal("0.00")


def _date_defaults(
    from_date: Optional[date],
    to_date: Optional[date],
) -> tuple[date, date]:
    end = to_date or date.today()
    start = from_date or date(end.year, 1, 1)
    if end < start:
        raise HTTPException(status_code=400, detail="to_date must be on or after from_date")
    return start, end


@router.get("/reports/summary")
async def payroll_summary(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(reports_access),
):
    start, end = _date_defaults(from_date, to_date)

    result = await db.execute(
        select(PayRun)
        .join(PayPeriod, PayRun.period_id == PayPeriod.id)
        .options(
            selectinload(PayRun.period),
            selectinload(PayRun.pay_group),
            selectinload(PayRun.approvals),
        )
        .where(
            PayRun.status.in_(sorted(FINAL_RUN_STATUSES)),
            PayPeriod.pay_date >= start,
            PayPeriod.pay_date <= end,
        )
        .order_by(PayPeriod.pay_date)
    )
    runs = list(result.scalars().all())

    totals = {
        "gross": ZERO,
        "employee_deductions": ZERO,
        "employer_contributions": ZERO,
        "net": ZERO,
        "employer_cost": ZERO,
        "employee_count": 0,
    }
    by_period: dict[str, dict] = {}

    for run in runs:
        totals["gross"] += dec(run.total_gross)
        totals["employee_deductions"] += dec(run.total_employee_deductions)
        totals["employer_contributions"] += dec(run.total_employer_contributions)
        totals["net"] += dec(run.total_net)
        totals["employer_cost"] += dec(run.total_employer_cost)
        totals["employee_count"] += run.employee_count

        key = run.period.name if run.period else str(run.period_id)
        bucket = by_period.setdefault(
            key,
            {
                "period_name": key,
                "pay_date": run.period.pay_date.isoformat() if run.period else None,
                "gross": ZERO,
                "net": ZERO,
                "employer_cost": ZERO,
                "employee_count": 0,
            },
        )
        bucket["gross"] += dec(run.total_gross)
        bucket["net"] += dec(run.total_net)
        bucket["employer_cost"] += dec(run.total_employer_cost)
        bucket["employee_count"] += run.employee_count

    return {
        "from_date": start,
        "to_date": end,
        "totals": {key: str(money(value)) if isinstance(value, Decimal) else value for key, value in totals.items()},
        "by_period": [
            {
                **bucket,
                "gross": str(money(bucket["gross"])),
                "net": str(money(bucket["net"])),
                "employer_cost": str(money(bucket["employer_cost"])),
            }
            for bucket in by_period.values()
        ],
        "runs": [run_to_dict(run) for run in runs],
    }


@router.get("/reports/statutory")
async def statutory_report(
    remittance_status: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(reports_access),
):
    query = (
        select(StatutoryRemittance)
        .options(selectinload(StatutoryRemittance.scheme))
        .order_by(StatutoryRemittance.due_date)
    )
    if remittance_status:
        query = query.where(StatutoryRemittance.status == remittance_status)

    result = await db.execute(query)
    remittances = list(result.scalars().all())

    by_scheme: dict[str, dict] = {}
    for remittance in remittances:
        code = remittance.scheme.code if remittance.scheme else remittance.scheme_name
        bucket = by_scheme.setdefault(
            code,
            {
                "scheme_code": code,
                "scheme_name": remittance.scheme_name,
                "employee_amount": ZERO,
                "employer_amount": ZERO,
                "total_amount": ZERO,
            },
        )
        bucket["employee_amount"] += dec(remittance.employee_amount)
        bucket["employer_amount"] += dec(remittance.employer_amount)
        bucket["total_amount"] += dec(remittance.total_amount)

    return {
        "total_employee": str(money(sum((dec(r.employee_amount) for r in remittances), ZERO))),
        "total_employer": str(money(sum((dec(r.employer_amount) for r in remittances), ZERO))),
        "total": str(money(sum((dec(r.total_amount) for r in remittances), ZERO))),
        "by_scheme": [
            {
                **bucket,
                "employee_amount": str(money(bucket["employee_amount"])),
                "employer_amount": str(money(bucket["employer_amount"])),
                "total_amount": str(money(bucket["total_amount"])),
            }
            for bucket in by_scheme.values()
        ],
        "remittances": [
            {
                "id": str(remittance.id),
                "run_id": str(remittance.run_id),
                "scheme_name": remittance.scheme_name,
                "employee_amount": remittance.employee_amount,
                "employer_amount": remittance.employer_amount,
                "total_amount": remittance.total_amount,
                "due_date": remittance.due_date,
                "status": remittance.status,
                "paid_at": remittance.paid_at,
                "reference": remittance.reference,
            }
            for remittance in remittances
        ],
    }


@router.get("/reports/department-cost")
async def department_cost_report(
    run_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(reports_access),
):
    run_result = await db.execute(
        select(PayRun)
        .options(selectinload(PayRun.period))
        .where(PayRun.id == run_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Pay run not found")

    result = await db.execute(
        select(
            PayRunItem.department,
            PayRunItem.cost_center,
            func.count(PayRunItem.id),
            func.coalesce(func.sum(PayRunItem.gross_pay), 0),
            func.coalesce(func.sum(PayRunItem.total_employer_contributions), 0),
            func.coalesce(func.sum(PayRunItem.net_pay), 0),
            func.coalesce(func.sum(PayRunItem.employer_cost), 0),
        )
        .where(
            PayRunItem.run_id == run_id,
            PayRunItem.status != "cancelled",
        )
        .group_by(PayRunItem.department, PayRunItem.cost_center)
        .order_by(PayRunItem.department, PayRunItem.cost_center)
    )

    rows = []
    for (
        department,
        cost_center,
        employee_count,
        gross,
        employer_contributions,
        net,
        employer_cost,
    ) in result.all():
        rows.append(
            {
                "department": department or "Unassigned",
                "cost_center": cost_center or "Unassigned",
                "employee_count": int(employee_count),
                "gross": str(money(dec(gross))),
                "employer_contributions": str(money(dec(employer_contributions))),
                "net": str(money(dec(net))),
                "employer_cost": str(money(dec(employer_cost))),
            }
        )

    return {
        "run_id": str(run.id),
        "period_name": run.period.name if run.period else None,
        "currency": run.currency,
        "rows": rows,
    }


@router.get("/reports/overview")
async def payroll_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(reports_access),
):
    runs_result = await db.execute(
        select(PayRun.status, func.count(PayRun.id)).group_by(PayRun.status)
    )
    run_counts = {status: int(count) for status, count in runs_result.all()}

    pending_remittances = await db.execute(
        select(
            func.count(StatutoryRemittance.id),
            func.coalesce(func.sum(StatutoryRemittance.total_amount), 0),
        ).where(StatutoryRemittance.status == "pending")
    )
    remittance_count, remittance_total = pending_remittances.one()

    active_loans = await db.execute(
        select(
            func.count(Loan.id),
            func.coalesce(func.sum(Loan.outstanding_balance), 0),
        ).where(Loan.status == "active")
    )
    loan_count, loan_balance = active_loans.one()

    return {
        "run_counts": run_counts,
        "pending_remittances": {
            "count": int(remittance_count),
            "total": str(money(dec(remittance_total))),
        },
        "active_loans": {
            "count": int(loan_count),
            "outstanding_balance": str(money(dec(loan_balance))),
        },
    }

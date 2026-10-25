from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_any_permission
from app.models.pydantic.payroll.schemas import PayslipResponse
from app.models.sql.payroll.employee import (
    EmployeeBankAccount,
    Loan,
    RecurringComponent,
)
from app.models.sql.payroll.payslip import Payslip
from app.models.sql.payroll.runs import PayRunItem
from app.services.payroll.payroll_service import (
    PayrollService,
    resolve_pay_profile,
)

router = APIRouter()

self_access = require_any_permission(
    [
        Permissions.PAYROLL_VIEW_OWN,
        Permissions.PAYROLL_VIEW,
        Permissions.PAYROLL_VIEW_ALL,
        Permissions.PAYROLL_PREPARE,
    ]
)


def _require_person(current_user):
    if not current_user.person_id:
        raise HTTPException(
            status_code=400,
            detail="This account is not linked to an employee profile.",
        )
    return current_user.person_id


@router.get("/me/profile")
async def get_my_pay_profile(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(self_access),
):
    person_id = _require_person(current_user)
    profile = await resolve_pay_profile(db, person_id, date.today())
    if not profile:
        raise HTTPException(status_code=404, detail="No pay profile is configured")

    bank_result = await db.execute(
        select(EmployeeBankAccount)
        .where(
            EmployeeBankAccount.person_id == person_id,
            EmployeeBankAccount.verification_status != "rejected",
        )
        .order_by(EmployeeBankAccount.is_primary.desc())
    )
    bank_accounts = [
        {
            "id": str(account.id),
            "bank_name": account.bank_name,
            "account_name": account.account_name,
            "account_number_last4": account.account_number_last4,
            "mobile_money_provider": account.mobile_money_provider,
            "is_primary": account.is_primary,
            "verification_status": account.verification_status,
            "effective_from": account.effective_from,
            "effective_to": account.effective_to,
        }
        for account in bank_result.scalars().all()
    ]

    component_result = await db.execute(
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(
            RecurringComponent.person_id == person_id,
            RecurringComponent.is_active.is_(True),
        )
        .order_by(RecurringComponent.created_at)
    )
    components = [
        {
            "id": str(component.id),
            "code": (
                component.component_type.code
                if component.component_type
                else None
            ),
            "name": (
                component.component_type.name
                if component.component_type
                else None
            ),
            "category": (
                component.component_type.category
                if component.component_type
                else None
            ),
            "amount": component.amount,
            "rate": component.rate,
            "remaining_amount": component.remaining_amount,
            "effective_from": component.effective_from,
            "effective_to": component.effective_to,
        }
        for component in component_result.scalars().all()
    ]

    loan_result = await db.execute(
        select(Loan).where(
            Loan.person_id == person_id,
            Loan.status == "active",
        )
    )
    loans = [
        {
            "id": str(loan.id),
            "principal": loan.principal,
            "installment_amount": loan.installment_amount,
            "outstanding_balance": loan.outstanding_balance,
            "term_months": loan.term_months,
            "start_date": loan.start_date,
        }
        for loan in loan_result.scalars().all()
    ]

    return {
        "person_id": str(profile.person_id),
        "pay_group_id": str(profile.pay_group_id) if profile.pay_group_id else None,
        "pay_type": profile.pay_type,
        "base_amount": profile.base_amount,
        "hourly_rate": profile.hourly_rate,
        "currency": profile.currency,
        "overtime_multiplier": profile.overtime_multiplier,
        "payment_method": profile.payment_method,
        "department": profile.department,
        "effective_from": profile.effective_from,
        "effective_to": profile.effective_to,
        "bank_accounts": bank_accounts,
        "recurring_components": components,
        "loans": loans,
    }


@router.get("/me/payslips", response_model=list[PayslipResponse])
async def get_my_payslips(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(self_access),
):
    person_id = _require_person(current_user)
    payslips = await PayrollService.list_payslips(db, person_id)
    return [
        PayrollService.payslip_to_dict(payslip, include_lines=True)
        for payslip in payslips
        if payslip.status == "issued"
    ]


@router.get("/me/payslips/{payslip_id}", response_model=PayslipResponse)
async def get_my_payslip(
    payslip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(self_access),
):
    person_id = _require_person(current_user)
    result = await db.execute(
        select(Payslip)
        .options(
            selectinload(Payslip.period),
            selectinload(Payslip.item).selectinload(PayRunItem.lines),
        )
        .where(
            Payslip.id == payslip_id,
            Payslip.person_id == person_id,
            Payslip.status == "issued",
        )
    )
    payslip = result.scalar_one_or_none()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")
    return PayrollService.payslip_to_dict(payslip, include_lines=True)


@router.post(
    "/me/payslips/{payslip_id}/viewed",
    response_model=PayslipResponse,
)
async def mark_my_payslip_viewed(
    payslip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(self_access),
):
    person_id = _require_person(current_user)
    payslip = await PayrollService.mark_payslip_viewed(
        db,
        payslip_id=payslip_id,
        person_id=person_id,
    )
    result = await db.execute(
        select(Payslip)
        .options(
            selectinload(Payslip.period),
            selectinload(Payslip.item).selectinload(PayRunItem.lines),
        )
        .where(Payslip.id == payslip.id)
    )
    return PayrollService.payslip_to_dict(result.scalar_one(), include_lines=True)

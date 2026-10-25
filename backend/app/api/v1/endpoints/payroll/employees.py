from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_any_permission
from app.models.pydantic.payroll.schemas import (
    BankAccountApprove,
    BankAccountCreate,
    BankAccountReject,
    BankAccountResponse,
    LoanApprove,
    LoanCreate,
    LoanResponse,
    PayProfileResponse,
    PayProfileUpsert,
    RecurringComponentCreate,
    RecurringComponentResponse,
)
from app.models.sql.core.user import Person
from app.models.sql.payroll.config import PayComponentType, PayGroup
from app.models.sql.payroll.employee import (
    EmployeeBankAccount,
    EmployeePayProfile,
    Loan,
    LoanInstallment,
    RecurringComponent,
)
from app.services.core.audit_service import AuditService
from app.services.payroll.calculator import dec, money
from app.services.payroll.encryption import BankAccountEncryption
from app.services.payroll.payroll_service import add_months, person_name

router = APIRouter()

PAY_TYPES = {"salaried", "hourly", "mixed"}

view_access = require_any_permission(
    [
        Permissions.PAYROLL_VIEW_ALL,
        Permissions.PAYROLL_PREPARE,
        Permissions.PAYROLL_CONFIG,
        Permissions.PAYROLL_REVIEW_FINANCE,
    ]
)
setup_access = require_any_permission(
    [Permissions.PAYROLL_PREPARE, Permissions.PAYROLL_CONFIG]
)
bank_approval_access = require_any_permission(
    [Permissions.PAYROLL_REVIEW_FINANCE, Permissions.PAYROLL_APPROVE]
)
loan_approval_access = require_any_permission(
    [Permissions.PAYROLL_APPROVE, Permissions.PAYROLL_REVIEW_FINANCE]
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def profile_to_dict(profile: EmployeePayProfile) -> dict:
    return {
        "id": str(profile.id),
        "person_id": str(profile.person_id),
        "person_name": person_name(profile.person) if profile.person else None,
        "pay_group_id": str(profile.pay_group_id) if profile.pay_group_id else None,
        "pay_type": profile.pay_type,
        "base_amount": profile.base_amount,
        "hourly_rate": profile.hourly_rate,
        "currency": profile.currency,
        "overtime_multiplier": profile.overtime_multiplier,
        "payment_method": profile.payment_method,
        "cost_center": profile.cost_center,
        "department": profile.department,
        "effective_from": profile.effective_from,
        "effective_to": profile.effective_to,
        "is_active": profile.is_active,
        "notes": profile.notes,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def recurring_to_dict(component: RecurringComponent) -> dict:
    component_type = component.component_type
    return {
        "id": str(component.id),
        "person_id": str(component.person_id),
        "component_type_id": str(component.component_type_id),
        "component_code": component_type.code if component_type else None,
        "component_name": component_type.name if component_type else None,
        "component_category": component_type.category if component_type else None,
        "amount": component.amount,
        "rate": component.rate,
        "effective_from": component.effective_from,
        "effective_to": component.effective_to,
        "remaining_amount": component.remaining_amount,
        "is_active": component.is_active,
        "notes": component.notes,
        "created_at": component.created_at,
    }


async def _person_or_404(db: AsyncSession, person_id: str) -> Person:
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


async def _load_profile(db: AsyncSession, profile_id) -> EmployeePayProfile:
    result = await db.execute(
        select(EmployeePayProfile)
        .options(selectinload(EmployeePayProfile.person))
        .where(EmployeePayProfile.id == profile_id)
    )
    return result.scalar_one()


# ============================================================
# EMPLOYEE PAY PROFILES
# ============================================================

@router.get("/profiles", response_model=list[PayProfileResponse])
async def list_pay_profiles(
    person_id: Optional[str] = None,
    pay_group_id: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    query = (
        select(EmployeePayProfile)
        .options(selectinload(EmployeePayProfile.person))
        .order_by(
            EmployeePayProfile.person_id,
            EmployeePayProfile.effective_from.desc(),
        )
    )
    if person_id:
        query = query.where(EmployeePayProfile.person_id == person_id)
    if pay_group_id:
        query = query.where(EmployeePayProfile.pay_group_id == pay_group_id)
    if active_only:
        query = query.where(EmployeePayProfile.is_active.is_(True))
    if search:
        term = f"%{search.strip()}%"
        query = query.join(
            Person, EmployeePayProfile.person_id == Person.id
        ).where(
            or_(
                Person.first_name.ilike(term),
                Person.last_name.ilike(term),
                Person.employee_number.ilike(term),
            )
        )

    result = await db.execute(query.offset(offset).limit(limit))
    return [profile_to_dict(profile) for profile in result.scalars().all()]


@router.get("/profiles/{person_id}", response_model=PayProfileResponse)
async def get_pay_profile(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    result = await db.execute(
        select(EmployeePayProfile)
        .options(selectinload(EmployeePayProfile.person))
        .where(
            EmployeePayProfile.person_id == person_id,
            EmployeePayProfile.is_active.is_(True),
        )
        .order_by(EmployeePayProfile.effective_from.desc())
        .limit(1)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Pay profile not found")
    return profile_to_dict(profile)


@router.post(
    "/profiles",
    response_model=PayProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_pay_profile(
    payload: PayProfileUpsert,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    person = await _person_or_404(db, payload.person_id)

    if payload.pay_type not in PAY_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"pay_type must be one of {sorted(PAY_TYPES)}",
        )
    if payload.base_amount < 0 or payload.hourly_rate < 0:
        raise HTTPException(status_code=400, detail="Pay amounts cannot be negative")
    if payload.overtime_multiplier <= 0:
        raise HTTPException(status_code=400, detail="overtime_multiplier must be positive")
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")
    if payload.pay_group_id:
        group_result = await db.execute(
            select(PayGroup).where(PayGroup.id == payload.pay_group_id)
        )
        if not group_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Pay group not found")

    existing_result = await db.execute(
        select(EmployeePayProfile).where(
            EmployeePayProfile.person_id == payload.person_id,
            EmployeePayProfile.effective_from == payload.effective_from,
        )
    )
    profile = existing_result.scalar_one_or_none()

    values = payload.model_dump(exclude={"person_id"})

    if profile:
        for key, value in values.items():
            setattr(profile, key, value)
        action = "PAY_PROFILE_UPDATED"
    else:
        previous_result = await db.execute(
            select(EmployeePayProfile)
            .where(
                EmployeePayProfile.person_id == payload.person_id,
                EmployeePayProfile.effective_from < payload.effective_from,
            )
            .order_by(EmployeePayProfile.effective_from.desc())
            .limit(1)
        )
        previous = previous_result.scalar_one_or_none()
        if previous and (
            previous.effective_to is None
            or previous.effective_to >= payload.effective_from
        ):
            previous.effective_to = payload.effective_from - timedelta(days=1)

        profile = EmployeePayProfile(
            id=str(uuid.uuid4()),
            person_id=payload.person_id,
            **values,
        )
        db.add(profile)
        action = "PAY_PROFILE_CREATED"

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action=action,
        entity_type="payroll_employee_profile",
        entity_id=profile.id,
        description=f"Set pay profile for {person_name(person)}",
        new_values={
            "person_id": str(payload.person_id),
            "pay_type": payload.pay_type,
            "base_amount": str(payload.base_amount),
            "hourly_rate": str(payload.hourly_rate),
            "effective_from": payload.effective_from.isoformat(),
        },
    )
    await db.commit()
    return profile_to_dict(await _load_profile(db, profile.id))


@router.post(
    "/profiles/{profile_id}/deactivate",
    response_model=PayProfileResponse,
)
async def deactivate_pay_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    result = await db.execute(
        select(EmployeePayProfile).where(EmployeePayProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Pay profile not found")

    profile.is_active = False
    profile.effective_to = profile.effective_to or date.today()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_PROFILE_DEACTIVATED",
        entity_type="payroll_employee_profile",
        entity_id=profile.id,
        description="Deactivated employee pay profile",
        new_values={"person_id": str(profile.person_id)},
    )
    await db.commit()
    return profile_to_dict(await _load_profile(db, profile.id))


# ============================================================
# BANK ACCOUNTS
# ============================================================

@router.get(
    "/people/{person_id}/bank-accounts",
    response_model=list[BankAccountResponse],
)
async def list_bank_accounts(
    person_id: str,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    await _person_or_404(db, person_id)
    query = (
        select(EmployeeBankAccount)
        .where(EmployeeBankAccount.person_id == person_id)
        .order_by(EmployeeBankAccount.is_primary.desc(), EmployeeBankAccount.created_at.desc())
    )
    if not include_inactive:
        query = query.where(EmployeeBankAccount.verification_status != "rejected")
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/people/{person_id}/bank-accounts",
    response_model=BankAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_bank_account(
    person_id: str,
    payload: BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    await _person_or_404(db, person_id)

    account_number = payload.account_number.strip()
    if len(account_number) < 4:
        raise HTTPException(status_code=400, detail="A valid account number is required")
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    if payload.is_primary:
        existing_primary = await db.execute(
            select(EmployeeBankAccount).where(
                EmployeeBankAccount.person_id == person_id,
                EmployeeBankAccount.is_primary.is_(True),
                EmployeeBankAccount.verification_status != "rejected",
            )
        )
        for account in existing_primary.scalars().all():
            account.is_primary = False

    account = EmployeeBankAccount(
        id=str(uuid.uuid4()),
        person_id=person_id,
        bank_name=payload.bank_name,
        branch=payload.branch,
        bank_code=payload.bank_code,
        account_name=payload.account_name,
        account_number_encrypted=BankAccountEncryption.encrypt(account_number),
        account_number_last4=BankAccountEncryption.last4(account_number),
        mobile_money_provider=payload.mobile_money_provider,
        is_primary=payload.is_primary,
        verification_status="pending",
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        created_by_id=current_user.person_id,
    )
    db.add(account)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_BANK_ACCOUNT_CREATED",
        entity_type="payroll_bank_account",
        entity_id=account.id,
        description="Added employee bank account",
        new_values={
            "person_id": str(person_id),
            "bank_name": account.bank_name,
            "account_last4": account.account_number_last4,
            "is_primary": account.is_primary,
        },
    )
    await db.commit()
    await db.refresh(account)
    return account


@router.post(
    "/bank-accounts/{account_id}/approve",
    response_model=BankAccountResponse,
)
async def approve_bank_account(
    account_id: str,
    payload: BankAccountApprove,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(bank_approval_access),
):
    result = await db.execute(
        select(EmployeeBankAccount).where(EmployeeBankAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if account.verification_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bank account is already {account.verification_status}",
        )

    if (
        account.created_by_id
        and str(account.created_by_id) == str(current_user.person_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Segregation of duties: the person who captured the bank "
                "details cannot verify them."
            ),
        )

    if account.is_primary:
        existing_primary = await db.execute(
            select(EmployeeBankAccount).where(
                EmployeeBankAccount.person_id == account.person_id,
                EmployeeBankAccount.is_primary.is_(True),
                EmployeeBankAccount.id != account.id,
            )
        )
        for other in existing_primary.scalars().all():
            other.is_primary = False

    account.verification_status = "verified"
    account.verification_note = payload.note
    account.approved_by_id = current_user.person_id
    account.approved_at = _utcnow()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_BANK_ACCOUNT_VERIFIED",
        entity_type="payroll_bank_account",
        entity_id=account.id,
        description="Verified employee bank account",
        new_values={
            "person_id": str(account.person_id),
            "account_last4": account.account_number_last4,
        },
    )
    await db.commit()
    await db.refresh(account)
    return account


@router.post(
    "/bank-accounts/{account_id}/reject",
    response_model=BankAccountResponse,
)
async def reject_bank_account(
    account_id: str,
    payload: BankAccountReject,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(bank_approval_access),
):
    result = await db.execute(
        select(EmployeeBankAccount).where(EmployeeBankAccount.id == account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if account.verification_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Bank account is already {account.verification_status}",
        )

    account.verification_status = "rejected"
    account.verification_note = payload.reason
    account.is_primary = False

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_BANK_ACCOUNT_REJECTED",
        entity_type="payroll_bank_account",
        entity_id=account.id,
        description="Rejected employee bank account",
        new_values={"reason": payload.reason},
    )
    await db.commit()
    await db.refresh(account)
    return account


# ============================================================
# RECURRING EARNINGS AND DEDUCTIONS
# ============================================================

@router.get(
    "/people/{person_id}/recurring-components",
    response_model=list[RecurringComponentResponse],
)
async def list_recurring_components(
    person_id: str,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    await _person_or_404(db, person_id)
    query = (
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(RecurringComponent.person_id == person_id)
        .order_by(RecurringComponent.created_at.desc())
    )
    if active_only:
        query = query.where(RecurringComponent.is_active.is_(True))
    result = await db.execute(query)
    return [recurring_to_dict(component) for component in result.scalars().all()]


@router.post(
    "/people/{person_id}/recurring-components",
    response_model=RecurringComponentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_recurring_component(
    person_id: str,
    payload: RecurringComponentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    await _person_or_404(db, person_id)

    type_result = await db.execute(
        select(PayComponentType).where(
            PayComponentType.id == payload.component_type_id
        )
    )
    component_type = type_result.scalar_one_or_none()
    if not component_type:
        raise HTTPException(status_code=404, detail="Component type not found")
    if not component_type.is_active:
        raise HTTPException(status_code=400, detail="Component type is inactive")
    if component_type.statutory:
        raise HTTPException(
            status_code=400,
            detail=(
                "Statutory deductions are configured as statutory schemes, "
                "not recurring components."
            ),
        )
    if payload.effective_to and payload.effective_to < payload.effective_from:
        raise HTTPException(status_code=400, detail="effective_to cannot be before effective_from")

    rate = dec(payload.rate)
    amount = dec(payload.amount)

    if component_type.calculation == "percent":
        rate = rate or dec(component_type.default_rate)
        if rate <= 0 or rate > 1:
            raise HTTPException(
                status_code=400,
                detail="A percentage component requires a rate between 0 and 1",
            )
        amount = Decimal("0")
    else:
        amount = amount or dec(component_type.default_amount)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="A fixed component requires an amount")

    order_total = payload.remaining_amount
    if order_total is not None and order_total < 0:
        raise HTTPException(status_code=400, detail="remaining_amount cannot be negative")

    component = RecurringComponent(
        id=str(uuid.uuid4()),
        person_id=person_id,
        component_type_id=payload.component_type_id,
        amount=money(amount),
        rate=rate,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
        remaining_amount=order_total,
        is_active=payload.is_active,
        notes=payload.notes,
    )
    db.add(component)
    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_RECURRING_COMPONENT_CREATED",
        entity_type="payroll_recurring_component",
        entity_id=component.id,
        description=f"Added {component_type.name} for employee",
        new_values={
            "person_id": str(person_id),
            "component_type": component_type.code,
            "amount": str(component.amount),
            "rate": str(component.rate),
        },
    )
    await db.commit()

    loaded = await db.execute(
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(RecurringComponent.id == component.id)
    )
    return recurring_to_dict(loaded.scalar_one())


@router.post(
    "/recurring-components/{component_id}/deactivate",
    response_model=RecurringComponentResponse,
)
async def deactivate_recurring_component(
    component_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    result = await db.execute(
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(RecurringComponent.id == component_id)
    )
    component = result.scalar_one_or_none()
    if not component:
        raise HTTPException(status_code=404, detail="Recurring component not found")

    component.is_active = False
    component.effective_to = component.effective_to or date.today()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_RECURRING_COMPONENT_DEACTIVATED",
        entity_type="payroll_recurring_component",
        entity_id=component.id,
        description="Deactivated recurring pay component",
    )
    await db.commit()

    loaded = await db.execute(
        select(RecurringComponent)
        .options(selectinload(RecurringComponent.component_type))
        .where(RecurringComponent.id == component.id)
        .execution_options(populate_existing=True)
    )
    return recurring_to_dict(loaded.scalar_one())


# ============================================================
# STAFF LOANS
# ============================================================

@router.get("/people/{person_id}/loans", response_model=list[LoanResponse])
async def list_loans(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    await _person_or_404(db, person_id)
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.installments))
        .where(Loan.person_id == person_id)
        .order_by(Loan.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/people/{person_id}/loans",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_loan(
    person_id: str,
    payload: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(setup_access),
):
    await _person_or_404(db, person_id)

    if payload.principal <= 0:
        raise HTTPException(status_code=400, detail="principal must be positive")
    if payload.installment_amount <= 0:
        raise HTTPException(status_code=400, detail="installment_amount must be positive")
    if payload.interest_rate < 0 or payload.interest_rate > 1:
        raise HTTPException(
            status_code=400,
            detail="interest_rate must be a decimal between 0 and 1",
        )

    interest = money(
        dec(payload.principal)
        * dec(payload.interest_rate)
        * dec(payload.term_months)
        / dec(12)
    )
    total_repayable = money(dec(payload.principal) + interest)
    scheduled_total = money(dec(payload.installment_amount) * dec(payload.term_months))

    if scheduled_total < total_repayable:
        raise HTTPException(
            status_code=400,
            detail=(
                "Installments do not cover the loan. The minimum installment "
                f"is {money(total_repayable / dec(payload.term_months))}."
            ),
        )
    if (
        dec(payload.installment_amount) * dec(payload.term_months - 1)
        >= total_repayable
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Installments would repay the loan before the end of the term. "
                f"The maximum installment is {money(total_repayable / dec(max(payload.term_months - 1, 1)))}."
            ),
        )

    loan = Loan(
        id=str(uuid.uuid4()),
        person_id=person_id,
        principal=money(payload.principal),
        interest_rate=payload.interest_rate,
        installment_amount=money(payload.installment_amount),
        term_months=payload.term_months,
        start_date=payload.start_date,
        outstanding_balance=total_repayable,
        status="pending_approval",
        created_by_id=current_user.person_id,
        notes=payload.notes,
    )
    db.add(loan)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_LOAN_CREATED",
        entity_type="payroll_loan",
        entity_id=loan.id,
        description="Created staff loan",
        new_values={
            "person_id": str(person_id),
            "principal": str(loan.principal),
            "term_months": loan.term_months,
            "total_repayable": str(total_repayable),
        },
    )
    await db.commit()

    loaded = await db.execute(
        select(Loan)
        .options(selectinload(Loan.installments))
        .where(Loan.id == loan.id)
    )
    return loaded.scalar_one()


@router.post("/loans/{loan_id}/approve", response_model=LoanResponse)
async def approve_loan(
    loan_id: str,
    payload: LoanApprove,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(loan_approval_access),
):
    result = await db.execute(
        select(Loan)
        .options(selectinload(Loan.installments))
        .where(Loan.id == loan_id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.status != "pending_approval":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Loan is already {loan.status}",
        )

    if loan.created_by_id and str(loan.created_by_id) == str(current_user.person_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Segregation of duties: the creator cannot approve the loan.",
        )

    principal = dec(loan.principal)
    term = int(loan.term_months)
    total_repayable = dec(loan.outstanding_balance)
    installment = dec(loan.installment_amount)

    if term <= 0 or total_repayable <= 0:
        raise HTTPException(status_code=400, detail="Loan terms are invalid")

    remaining_total = total_repayable
    remaining_principal = principal
    base_principal = money(principal / dec(term))

    for sequence in range(1, term + 1):
        if sequence == term:
            amount = remaining_total
            principal_portion = remaining_principal
        else:
            amount = min(installment, remaining_total)
            principal_portion = min(base_principal, remaining_principal)

        principal_portion = money(principal_portion)
        interest_portion = money(amount - principal_portion)
        if interest_portion < 0:
            principal_portion = money(amount)
            interest_portion = Decimal("0.00")

        db.add(
            LoanInstallment(
                id=str(uuid.uuid4()),
                loan_id=loan.id,
                sequence=sequence,
                due_date=add_months(loan.start_date, sequence),
                amount=money(amount),
                principal_portion=principal_portion,
                interest_portion=interest_portion,
                status="pending",
            )
        )
        remaining_total -= amount
        remaining_principal -= principal_portion

    loan.status = "active"
    loan.approved_by_id = current_user.person_id
    if payload.note:
        loan.notes = (
            f"{loan.notes}\nApproval note: {payload.note}"
            if loan.notes
            else f"Approval note: {payload.note}"
        )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PAY_LOAN_APPROVED",
        entity_type="payroll_loan",
        entity_id=loan.id,
        description="Approved staff loan",
        new_values={
            "principal": str(loan.principal),
            "installment_amount": str(loan.installment_amount),
            "term_months": loan.term_months,
        },
    )
    await db.commit()

    loaded = await db.execute(
        select(Loan)
        .options(selectinload(Loan.installments))
        .where(Loan.id == loan.id)
        .execution_options(populate_existing=True)
    )
    return loaded.scalar_one()

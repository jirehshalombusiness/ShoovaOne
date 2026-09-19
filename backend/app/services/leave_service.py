from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, Sequence
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.approval import ApprovalRequest
from app.models.sql.leave import LeaveType, LeaveBalance, LeaveRequest
from app.models.sql.public_holiday import PublicHoliday
from app.models.sql.user import User, Person
from app.services.audit_service import AuditService
from app.services import approval_service


# ============================================================
# CONSTANTS
# ============================================================

# Leave types that require HR approval directly (skip manager routing).
HR_DIRECT_LEAVE_CODES = {"unpaid", "parental"}

# Leave types that can never be requested without documentation.
DOCS_ALWAYS_REQUIRED_CODES = {"study", "parental"}

# Number of consecutive sick days before documentation is required.
SICK_DOCS_THRESHOLD_DAYS = 2


# ============================================================
# WORKING DAY CALCULATION
# ============================================================

async def _load_holidays_in_range(
    db: AsyncSession,
    start: date,
    end: date,
) -> set[date]:
    """Return the set of public holiday dates between start and end inclusive."""
    result = await db.execute(
        select(PublicHoliday.holiday_date).where(
            PublicHoliday.holiday_date >= start,
            PublicHoliday.holiday_date <= end,
        )
    )
    return {row[0] for row in result.all()}


def _iter_days(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current = current + timedelta(days=1)


async def calculate_working_days(
    db: AsyncSession,
    start: date,
    end: date,
) -> Decimal:
    """
    Count working days between start and end inclusive.

    Excludes:
    - Saturdays and Sundays
    - Public holidays

    Returns a Decimal with one decimal place, matching
    LeaveBalance.total_days column precision.
    """
    if end < start:
        return Decimal("0.0")

    holidays = await _load_holidays_in_range(db, start, end)

    count = 0
    for day in _iter_days(start, end):
        if day.weekday() >= 5:  # Saturday=5, Sunday=6
            continue
        if day in holidays:
            continue
        count += 1

    return Decimal(str(count))


# ============================================================
# VALIDATION
# ============================================================

async def _load_leave_type(
    db: AsyncSession,
    leave_type_id: str,
) -> LeaveType:
    result = await db.execute(
        select(LeaveType).where(LeaveType.id == leave_type_id)
    )
    leave_type = result.scalar_one_or_none()

    if not leave_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave type not found",
        )

    if not leave_type.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Leave type '{leave_type.name}' is not active",
        )

    return leave_type


async def _load_balance(
    db: AsyncSession,
    person_id: str,
    leave_type_id: str,
    year: int,
) -> Optional[LeaveBalance]:
    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.person_id == person_id,
            LeaveBalance.leave_type_id == leave_type_id,
            LeaveBalance.year == year,
        )
    )
    return result.scalar_one_or_none()


async def _check_overlap(
    db: AsyncSession,
    person_id: str,
    start: date,
    end: date,
) -> None:
    """
    Reject if the requested range overlaps any pending or approved
    leave request for this person.

    Cancelled and rejected requests are ignored.
    """
    result = await db.execute(
        select(LeaveRequest).where(
            LeaveRequest.person_id == person_id,
            LeaveRequest.status.in_(["pending", "approved"]),
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
    )
    overlap = result.scalars().first()

    if overlap:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This request overlaps an existing {overlap.status} "
                f"leave from {overlap.start_date.isoformat()} "
                f"to {overlap.end_date.isoformat()}"
            ),
        )


def _validate_dates(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date",
        )

    # Allow requests up to 1 year in advance.
    max_horizon = date.today() + timedelta(days=365)
    if start > max_horizon:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave cannot be requested more than 1 year in advance",
        )

    # Allow retroactive submissions up to 7 days in the past
    # (sick leave is often logged after the fact).
    min_past = date.today() - timedelta(days=7)
    if start < min_past:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Leave cannot start more than 7 days in the past",
        )


def _validate_balance(
    balance: Optional[LeaveBalance],
    requested_days: Decimal,
    leave_type: LeaveType,
) -> None:
    # Unlimited leave types (e.g. unpaid) may not have a balance row.
    if balance is None:
        if leave_type.code in HR_DIRECT_LEAVE_CODES:
            return
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No leave balance exists for '{leave_type.name}'. "
                "Contact HR to set up your allocation."
            ),
        )

    available = (
        Decimal(str(balance.total_days))
        - Decimal(str(balance.used_days or 0))
        - Decimal(str(balance.pending_days or 0))
    )

    if available < requested_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient {leave_type.name} balance. "
                f"Available: {available} days, "
                f"requested: {requested_days} days."
            ),
        )


def _requires_documents(
    leave_type: LeaveType,
    total_days: Decimal,
) -> bool:
    if leave_type.requires_documentation:
        return True
    if leave_type.code in DOCS_ALWAYS_REQUIRED_CODES:
        return True
    if (
        leave_type.code == "sick"
        and total_days >= Decimal(str(SICK_DOCS_THRESHOLD_DAYS))
    ):
        return True
    return False


# ============================================================
# CREATE
# ============================================================

async def create_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    leave_type_id: str,
    start_date: date,
    end_date: date,
    reason: Optional[str] = None,
    attachment_ids: Optional[Sequence[str]] = None,
) -> LeaveRequest:
    """
    Create a leave request and its corresponding approval request.

    Steps:
    1. Validate leave type, dates, overlap.
    2. Compute working days.
    3. Check balance sufficiency.
    4. Create LeaveRequest in 'pending'.
    5. Increment LeaveBalance.pending_days.
    6. Create ApprovalRequest routed to manager or HR.
    7. Audit.

    All of this happens in a single transaction — the endpoint
    is responsible for calling db.commit() after this returns.
    """

    if not actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account has no linked employee record",
        )

    person_id = actor.person_id

    # ---- leave type ----
    leave_type = await _load_leave_type(db, leave_type_id)

    # ---- dates ----
    _validate_dates(start_date, end_date)

    # ---- overlap ----
    await _check_overlap(db, person_id, start_date, end_date)

    # ---- working days ----
    total_days = await calculate_working_days(db, start_date, end_date)
    if total_days <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected range contains no working days",
        )

    # ---- balance ----
    balance = await _load_balance(
        db,
        person_id,
        leave_type_id,
        start_date.year,
    )
    _validate_balance(balance, total_days, leave_type)

    # ---- documents ----
    if _requires_documents(leave_type, total_days):
        if not attachment_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"'{leave_type.name}' requires supporting documentation. "
                    "Attach at least one file."
                ),
            )

    # ---- create the leave request ----
    leave_request = LeaveRequest(
        id=str(uuid.uuid4()),
        person_id=person_id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        reason=reason,
        status="pending",
    )
    db.add(leave_request)
    await db.flush()

    # ---- increment pending days ----
    if balance is not None:
        balance.pending_days = (
            Decimal(str(balance.pending_days or 0)) + total_days
        )

    # ---- create approval request ----
    # HR-direct types skip the manager and go to HR.
    assigned_to_id: Optional[str] = None
    if leave_type.code not in HR_DIRECT_LEAVE_CODES:
        # Let the approval service resolve the manager.
        assigned_to_id = None
    else:
        # Force HR routing.
        assigned_to_id = await approval_service._find_hr_approver(db)

    await approval_service.create_request(
        db=db,
        entity_type="leave_request",
        entity_id=leave_request.id,
        requested_by_id=person_id,
        assigned_to_id=assigned_to_id,
        title=(
            f"{leave_type.name}: "
            f"{start_date.isoformat()} to {end_date.isoformat()}"
        ),
        summary=(
            f"{total_days} working days"
            + (f" — {reason[:180]}" if reason else "")
        ),
        priority="normal",
        due_hours=72,
    )

    # ---- audit ----
    await AuditService.log(
        db=db,
        actor=actor,
        action="LEAVE_REQUESTED",
        entity_type="leave_request",
        entity_id=leave_request.id,
        description=(
            f"Requested {total_days} days of {leave_type.name}"
        ),
        new_values={
            "leave_type": leave_type.code,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_days": str(total_days),
        },
    )

    return leave_request


# ============================================================
# DECIDE
# ============================================================

async def _load_leave_request(
    db: AsyncSession,
    leave_request_id: str,
) -> LeaveRequest:
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.id == leave_request_id)
    )
    leave_request = result.scalar_one_or_none()
    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )
    return leave_request


async def _load_linked_approval(
    db: AsyncSession,
    leave_request_id: str,
) -> Optional[ApprovalRequest]:
    result = await db.execute(
        select(ApprovalRequest).where(
            ApprovalRequest.entity_type == "leave_request",
            ApprovalRequest.entity_id == leave_request_id,
        )
    )
    return result.scalar_one_or_none()


async def approve_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    leave_request_id: str,
    note: Optional[str] = None,
) -> LeaveRequest:
    """
    Approve a leave request and settle the balance:
    - LeaveRequest.status -> 'approved'
    - LeaveBalance.pending_days -= total_days
    - LeaveBalance.used_days += total_days
    - ApprovalRequest.status -> 'approved'
    """

    leave_request = await _load_leave_request(db, leave_request_id)

    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve: request is already {leave_request.status}",
        )

    # Delegate authorization to the approval service.
    approval = await _load_linked_approval(db, leave_request_id)
    if approval is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Approval record missing for this leave request",
        )

    allowed = await approval_service.can_act_on(
        db,
        actor_person_id=actor.person_id,
        request=approval,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to approve this request",
        )

    total_days = Decimal(str(leave_request.total_days))

    # ---- settle balance ----
    balance = await _load_balance(
        db,
        leave_request.person_id,
        leave_request.leave_type_id,
        leave_request.start_date.year,
    )
    if balance is not None:
        balance.pending_days = max(
            Decimal("0"),
            Decimal(str(balance.pending_days or 0)) - total_days,
        )
        balance.used_days = (
            Decimal(str(balance.used_days or 0)) + total_days
        )

    # ---- update leave request ----
    leave_request.status = "approved"
    leave_request.approved_by = actor.person_id
    leave_request.approved_at = datetime.now(timezone.utc)

    # ---- update approval record ----
    await approval_service.approve(
        db,
        request_id=approval.id,
        actor=actor,
        note=note,
    )

    await AuditService.log(
        db=db,
        actor=actor,
        action="LEAVE_APPROVED",
        entity_type="leave_request",
        entity_id=leave_request.id,
        description="Approved leave request",
        new_values={"note": note},
    )

    return leave_request


async def reject_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    leave_request_id: str,
    note: str,
) -> LeaveRequest:
    """
    Reject a leave request and release the pending balance.
    """

    leave_request = await _load_leave_request(db, leave_request_id)

    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject: request is already {leave_request.status}",
        )

    approval = await _load_linked_approval(db, leave_request_id)
    if approval is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Approval record missing for this leave request",
        )

    allowed = await approval_service.can_act_on(
        db,
        actor_person_id=actor.person_id,
        request=approval,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to reject this request",
        )

    total_days = Decimal(str(leave_request.total_days))

    # ---- release pending balance ----
    balance = await _load_balance(
        db,
        leave_request.person_id,
        leave_request.leave_type_id,
        leave_request.start_date.year,
    )
    if balance is not None:
        balance.pending_days = max(
            Decimal("0"),
            Decimal(str(balance.pending_days or 0)) - total_days,
        )

    # ---- update leave request ----
    leave_request.status = "rejected"
    leave_request.approved_by = actor.person_id
    leave_request.approved_at = datetime.now(timezone.utc)
    leave_request.rejection_reason = note

    # ---- update approval record ----
    await approval_service.reject(
        db,
        request_id=approval.id,
        actor=actor,
        note=note,
    )

    await AuditService.log(
        db=db,
        actor=actor,
        action="LEAVE_REJECTED",
        entity_type="leave_request",
        entity_id=leave_request.id,
        description="Rejected leave request",
        new_values={"note": note},
    )

    return leave_request


async def cancel_leave_request(
    db: AsyncSession,
    *,
    actor: User,
    leave_request_id: str,
) -> LeaveRequest:
    """
    Requester withdraws a pending leave request.
    Only the requester can cancel, and only while still pending.
    """

    leave_request = await _load_leave_request(db, leave_request_id)

    if leave_request.person_id != actor.person_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the requester can cancel this leave request",
        )

    if leave_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel: request is already {leave_request.status}",
        )

    total_days = Decimal(str(leave_request.total_days))

    # ---- release pending balance ----
    balance = await _load_balance(
        db,
        leave_request.person_id,
        leave_request.leave_type_id,
        leave_request.start_date.year,
    )
    if balance is not None:
        balance.pending_days = max(
            Decimal("0"),
            Decimal(str(balance.pending_days or 0)) - total_days,
        )

    # ---- update leave request ----
    leave_request.status = "cancelled"

    # ---- update approval record ----
    approval = await _load_linked_approval(db, leave_request_id)
    if approval is not None and approval.status == "pending":
        await approval_service.cancel(
            db,
            request_id=approval.id,
            actor=actor,
        )

    await AuditService.log(
        db=db,
        actor=actor,
        action="LEAVE_CANCELLED",
        entity_type="leave_request",
        entity_id=leave_request.id,
        description="Cancelled leave request",
    )

    return leave_request


# ============================================================
# READ
# ============================================================

async def list_my_leave_requests(
    db: AsyncSession,
    *,
    person_id: str,
    limit: int = 100,
    offset: int = 0,
) -> list[LeaveRequest]:
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.person_id == person_id)
        .order_by(LeaveRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_all_leave_requests(
    db: AsyncSession,
    *,
    statuses: Optional[Sequence[str]] = None,
    leave_type_ids: Optional[Sequence[str]] = None,
    person_ids: Optional[Sequence[str]] = None,
    start_from: Optional[date] = None,
    end_before: Optional[date] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[LeaveRequest]:
    query = (
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.approver),
        )
    )

    if statuses:
        query = query.where(LeaveRequest.status.in_(list(statuses)))
    if leave_type_ids:
        query = query.where(LeaveRequest.leave_type_id.in_(list(leave_type_ids)))
    if person_ids:
        query = query.where(LeaveRequest.person_id.in_(list(person_ids)))
    if start_from:
        query = query.where(LeaveRequest.end_date >= start_from)
    if end_before:
        query = query.where(LeaveRequest.start_date <= end_before)

    query = (
        query
        .order_by(LeaveRequest.start_date.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())


async def list_my_balances(
    db: AsyncSession,
    *,
    person_id: str,
    year: Optional[int] = None,
) -> list[LeaveBalance]:
    if year is None:
        year = date.today().year

    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.person_id == person_id,
            LeaveBalance.year == year,
        )
        .order_by(LeaveBalance.year.desc())
    )
    return list(result.scalars().all())


# ============================================================
# BALANCE MAINTENANCE
# ============================================================

async def ensure_balances_for_year(
    db: AsyncSession,
    *,
    person_id: str,
    year: int,
) -> list[LeaveBalance]:
    """
    Create missing LeaveBalance rows for every active leave type
    that has a default_days allocation.

    Idempotent: existing rows are left untouched.
    """
    result = await db.execute(
        select(LeaveType).where(
            LeaveType.is_active.is_(True),
            LeaveType.default_days > 0,
        )
    )
    leave_types = list(result.scalars().all())

    result = await db.execute(
        select(LeaveBalance.leave_type_id).where(
            LeaveBalance.person_id == person_id,
            LeaveBalance.year == year,
        )
    )
    existing_type_ids = {row[0] for row in result.all()}

    created: list[LeaveBalance] = []
    for leave_type in leave_types:
        if leave_type.id in existing_type_ids:
            continue

        balance = LeaveBalance(
            id=str(uuid.uuid4()),
            person_id=person_id,
            leave_type_id=leave_type.id,
            year=year,
            total_days=Decimal(str(leave_type.default_days)),
            used_days=Decimal("0"),
            pending_days=Decimal("0"),
            carry_over_days=Decimal("0"),
        )
        db.add(balance)
        created.append(balance)

    return created


async def adjust_balance(
    db: AsyncSession,
    *,
    actor: User,
    balance_id: str,
    new_total_days: Optional[Decimal] = None,
    new_carry_over_days: Optional[Decimal] = None,
    note: Optional[str] = None,
) -> LeaveBalance:
    """
    HR manual adjustment of a leave balance.

    Records the change in the audit log with old and new values.
    Does not allow reducing total_days below used + pending.
    """
    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(LeaveBalance.id == balance_id)
    )
    balance = result.scalar_one_or_none()

    if not balance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave balance not found",
        )

    old_total = Decimal(str(balance.total_days))
    old_carry = Decimal(str(balance.carry_over_days or 0))

    committed = (
        Decimal(str(balance.used_days or 0))
        + Decimal(str(balance.pending_days or 0))
    )

    if new_total_days is not None:
        if new_total_days < committed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"New total ({new_total_days}) cannot be less than "
                    f"used + pending ({committed})"
                ),
            )
        balance.total_days = new_total_days

    if new_carry_over_days is not None:
        balance.carry_over_days = new_carry_over_days

    await AuditService.log(
        db=db,
        actor=actor,
        action="LEAVE_BALANCE_ADJUSTED",
        entity_type="leave_balance",
        entity_id=balance.id,
        description=(
            f"Adjusted {balance.leave_type.name} balance "
            f"for year {balance.year}"
        ),
        old_values={
            "total_days": str(old_total),
            "carry_over_days": str(old_carry),
        },
        new_values={
            "total_days": str(balance.total_days),
            "carry_over_days": str(balance.carry_over_days),
            "note": note,
        },
    )

    return balance
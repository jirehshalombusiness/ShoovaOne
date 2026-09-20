from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.models.sql.leave import LeaveType, LeaveBalance, LeaveRequest
from app.models.sql.approval import ApprovalRequest
from app.services import leave_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class AdminLeaveRequester(BaseModel):
    id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None


class AdminLeaveRequest(BaseModel):
    id: str
    person_id: str
    person: AdminLeaveRequester
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    start_date: str
    end_date: str
    total_days: float
    reason: Optional[str] = None
    status: str
    approved_by_id: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: str
    approval_id: Optional[str] = None
    approval_status: Optional[str] = None
    approval_assigned_to_id: Optional[str] = None
    approval_assigned_to_name: Optional[str] = None


class AdminLeaveListResponse(BaseModel):
    items: List[AdminLeaveRequest]
    total: int
    pending: int
    approved: int
    rejected: int


class AdminLeaveBalance(BaseModel):
    id: str
    person_id: str
    person_name: str
    person_image: Optional[str] = None
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    year: int
    total_days: float
    used_days: float
    pending_days: float
    carry_over_days: float
    remaining_days: float


class BalanceAdjustRequest(BaseModel):
    new_total_days: Optional[float] = Field(None, ge=0)
    new_carry_over_days: Optional[float] = Field(None, ge=0)
    note: Optional[str] = Field(None, max_length=500)


class BalanceCreateRequest(BaseModel):
    person_id: str
    leave_type_id: str
    year: int = Field(..., ge=2000, le=2100)
    total_days: float = Field(..., ge=0)
    carry_over_days: float = Field(0, ge=0)


class CalendarEntry(BaseModel):
    id: str
    person_id: str
    person_name: str
    person_image: Optional[str] = None
    leave_type_name: str
    leave_type_color: str
    start_date: str
    end_date: str
    total_days: float
    status: str


class LeaveStats(BaseModel):
    pending: int
    approved_this_month: int
    rejected_this_month: int
    currently_on_leave: int
    upcoming_7_days: int
    by_type: dict


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def _dec(v) -> float:
    if v is None:
        return 0.0
    return float(v)


def _person_name(p: Optional[Person]) -> Optional[str]:
    if not p:
        return None
    return f"{p.first_name} {p.last_name}".strip()


# ============================================================
# LIST ALL LEAVE REQUESTS
# ============================================================

@router.get("", response_model=AdminLeaveListResponse)
async def list_all_leave_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    leave_type_id: Optional[str] = None,
    person_id: Optional[str] = None,
    department: Optional[str] = None,
    start_from: Optional[date] = None,
    end_before: Optional[date] = None,
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """
    All leave requests in the org, with rich filters.

    Requires hr.view_leave.
    """
    filters = []

    if status_filter and status_filter != "all":
        filters.append(LeaveRequest.status == status_filter)

    if leave_type_id:
        filters.append(LeaveRequest.leave_type_id == leave_type_id)

    if person_id:
        filters.append(LeaveRequest.person_id == person_id)

    if start_from:
        filters.append(LeaveRequest.end_date >= start_from)

    if end_before:
        filters.append(LeaveRequest.start_date <= end_before)

    if department:
        filters.append(
            LeaveRequest.person_id.in_(
                select(Person.id).where(
                    Person.department == department,
                    Person.deleted_at.is_(None),
                )
            )
        )

    # Count aggregation per status (independent of status_filter)
    status_counts = await db.execute(
        select(LeaveRequest.status, func.count(LeaveRequest.id))
        .group_by(LeaveRequest.status)
    )
    status_map = {row[0]: row[1] for row in status_counts.all()}

    count_query = select(func.count(LeaveRequest.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = (
        select(LeaveRequest)
        .options(
            selectinload(LeaveRequest.leave_type),
            selectinload(LeaveRequest.approver),
        )
    )

    if search:
        pattern = f"%{search}%"
        query = query.join(Person, Person.id == LeaveRequest.person_id).where(
            or_(
                Person.first_name.ilike(pattern),
                Person.last_name.ilike(pattern),
            )
        )

    if filters:
        query = query.where(*filters)

    query = (
        query
        .order_by(
            LeaveRequest.status.asc(),
            LeaveRequest.start_date.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    requests = list(result.scalars().all())

    # Batch-load persons and approvals
    person_ids = {r.person_id for r in requests}
    persons: dict[str, Person] = {}
    if person_ids:
        p_result = await db.execute(
            select(Person).where(Person.id.in_(list(person_ids)))
        )
        persons = {p.id: p for p in p_result.scalars().all()}

    approval_map: dict[str, ApprovalRequest] = {}
    if requests:
        a_result = await db.execute(
            select(ApprovalRequest)
            .options(selectinload(ApprovalRequest.assigned_to))
            .where(
                ApprovalRequest.entity_type == "leave_request",
                ApprovalRequest.entity_id.in_([r.id for r in requests]),
            )
        )
        for a in a_result.scalars().all():
            approval_map[a.entity_id] = a

    items: List[AdminLeaveRequest] = []
    for r in requests:
        person = persons.get(r.person_id)
        approval = approval_map.get(r.id)
        items.append(
            AdminLeaveRequest(
                id=r.id,
                person_id=r.person_id,
                person=AdminLeaveRequester(
                    id=r.person_id,
                    first_name=person.first_name if person else "",
                    last_name=person.last_name if person else "",
                    profile_image_url=person.profile_image_url if person else None,
                    job_title=person.job_title if person else None,
                    department=person.department if person else None,
                ),
                leave_type_id=r.leave_type_id,
                leave_type_name=r.leave_type.name if r.leave_type else "Unknown",
                leave_type_color=r.leave_type.color if r.leave_type else "#176b4d",
                start_date=r.start_date.isoformat(),
                end_date=r.end_date.isoformat(),
                total_days=_dec(r.total_days),
                reason=r.reason,
                status=r.status,
                approved_by_id=r.approved_by,
                approved_by_name=_person_name(r.approver),
                approved_at=_iso(r.approved_at),
                rejection_reason=r.rejection_reason,
                created_at=r.created_at.isoformat() if r.created_at else "",
                approval_id=approval.id if approval else None,
                approval_status=approval.status if approval else None,
                approval_assigned_to_id=approval.assigned_to_id if approval else None,
                approval_assigned_to_name=(
                    _person_name(approval.assigned_to) if approval and approval.assigned_to else None
                ),
            )
        )

    return AdminLeaveListResponse(
        items=items,
        total=total,
        pending=status_map.get("pending", 0),
        approved=status_map.get("approved", 0),
        rejected=status_map.get("rejected", 0),
    )


# ============================================================
# LEAVE STATS
# ============================================================

@router.get("/stats", response_model=LeaveStats)
async def leave_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """Org-wide leave metrics for the HR dashboard."""
    today = date.today()
    month_start = today.replace(day=1)
    seven_days = today + timedelta(days=7)

    pending_result = await db.execute(
        select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "pending")
    )
    pending = pending_result.scalar() or 0

    approved_month_result = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.status == "approved",
            LeaveRequest.approved_at >= month_start,
        )
    )
    approved_this_month = approved_month_result.scalar() or 0

    rejected_month_result = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.status == "rejected",
            LeaveRequest.approved_at >= month_start,
        )
    )
    rejected_this_month = rejected_month_result.scalar() or 0

    on_leave_result = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.status == "approved",
            LeaveRequest.start_date <= today,
            LeaveRequest.end_date >= today,
        )
    )
    currently_on_leave = on_leave_result.scalar() or 0

    upcoming_result = await db.execute(
        select(func.count(LeaveRequest.id)).where(
            LeaveRequest.status == "approved",
            LeaveRequest.start_date > today,
            LeaveRequest.start_date <= seven_days,
        )
    )
    upcoming_7_days = upcoming_result.scalar() or 0

    by_type_result = await db.execute(
        select(LeaveType.name, func.count(LeaveRequest.id))
        .join(LeaveRequest, LeaveRequest.leave_type_id == LeaveType.id)
        .where(LeaveRequest.status == "approved")
        .group_by(LeaveType.name)
    )
    by_type = {row[0]: row[1] for row in by_type_result.all()}

    return LeaveStats(
        pending=pending,
        approved_this_month=approved_this_month,
        rejected_this_month=rejected_this_month,
        currently_on_leave=currently_on_leave,
        upcoming_7_days=upcoming_7_days,
        by_type=by_type,
    )


# ============================================================
# BALANCES
# ============================================================

@router.get("/balances", response_model=List[AdminLeaveBalance])
async def list_all_balances(
    year: Optional[int] = None,
    leave_type_id: Optional[str] = None,
    person_id: Optional[str] = None,
    department: Optional[str] = None,
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """
    All leave balances. Filterable for auditing.
    """
    if year is None:
        year = date.today().year

    filters = [LeaveBalance.year == year]

    if leave_type_id:
        filters.append(LeaveBalance.leave_type_id == leave_type_id)

    if person_id:
        filters.append(LeaveBalance.person_id == person_id)

    if department:
        filters.append(
            LeaveBalance.person_id.in_(
                select(Person.id).where(
                    Person.department == department,
                    Person.deleted_at.is_(None),
                )
            )
        )

    result = await db.execute(
        select(LeaveBalance, Person)
        .options(selectinload(LeaveBalance.leave_type))
        .join(Person, Person.id == LeaveBalance.person_id)
        .where(*filters)
        .order_by(Person.first_name, LeaveBalance.leave_type_id)
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()

    return [
        AdminLeaveBalance(
            id=b.id,
            person_id=b.person_id,
            person_name=f"{p.first_name} {p.last_name}".strip(),
            person_image=p.profile_image_url,
            leave_type_id=b.leave_type_id,
            leave_type_name=b.leave_type.name if b.leave_type else "Unknown",
            leave_type_color=b.leave_type.color if b.leave_type else "#176b4d",
            year=b.year,
            total_days=_dec(b.total_days),
            used_days=_dec(b.used_days),
            pending_days=_dec(b.pending_days),
            carry_over_days=_dec(b.carry_over_days),
            remaining_days=(
                _dec(b.total_days) - _dec(b.used_days) - _dec(b.pending_days)
            ),
        )
        for b, p in rows
    ]


@router.post(
    "/balances",
    response_model=AdminLeaveBalance,
    status_code=status.HTTP_201_CREATED,
)
async def create_balance(
    payload: BalanceCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    """
    Manually create a leave balance for a person.
    Useful for onboarding someone mid-year.
    """
    # Validate person exists
    person_result = await db.execute(
        select(Person).where(
            Person.id == payload.person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Validate leave type
    lt_result = await db.execute(
        select(LeaveType).where(LeaveType.id == payload.leave_type_id)
    )
    leave_type = lt_result.scalar_one_or_none()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    # Prevent duplicates
    existing_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.person_id == payload.person_id,
            LeaveBalance.leave_type_id == payload.leave_type_id,
            LeaveBalance.year == payload.year,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="A balance already exists for this person, type, and year",
        )

    balance = LeaveBalance(
        id=str(uuid.uuid4()),
        person_id=payload.person_id,
        leave_type_id=payload.leave_type_id,
        year=payload.year,
        total_days=Decimal(str(payload.total_days)),
        used_days=Decimal("0"),
        pending_days=Decimal("0"),
        carry_over_days=Decimal(str(payload.carry_over_days)),
    )
    db.add(balance)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEAVE_BALANCE_CREATED",
        entity_type="leave_balance",
        entity_id=balance.id,
        description=(
            f"Created {leave_type.name} balance for "
            f"{person.first_name} {person.last_name} ({payload.year})"
        ),
        new_values={
            "total_days": payload.total_days,
            "carry_over_days": payload.carry_over_days,
        },
    )

    await db.commit()
    await db.refresh(balance)
    await db.refresh(leave_type)

    return AdminLeaveBalance(
        id=balance.id,
        person_id=balance.person_id,
        person_name=f"{person.first_name} {person.last_name}".strip(),
        person_image=person.profile_image_url,
        leave_type_id=balance.leave_type_id,
        leave_type_name=leave_type.name,
        leave_type_color=leave_type.color or "#176b4d",
        year=balance.year,
        total_days=_dec(balance.total_days),
        used_days=_dec(balance.used_days),
        pending_days=_dec(balance.pending_days),
        carry_over_days=_dec(balance.carry_over_days),
        remaining_days=(
            _dec(balance.total_days) - _dec(balance.used_days) - _dec(balance.pending_days)
        ),
    )


@router.patch(
    "/balances/{balance_id}",
    response_model=AdminLeaveBalance,
)
async def adjust_balance(
    balance_id: str,
    payload: BalanceAdjustRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    """
    Manually adjust a balance.
    Cannot drop total below used + pending.
    """
    balance = await leave_service.adjust_balance(
        db=db,
        actor=current_user,
        balance_id=balance_id,
        new_total_days=(
            Decimal(str(payload.new_total_days))
            if payload.new_total_days is not None
            else None
        ),
        new_carry_over_days=(
            Decimal(str(payload.new_carry_over_days))
            if payload.new_carry_over_days is not None
            else None
        ),
        note=payload.note,
    )

    await db.commit()
    await db.refresh(balance)

    person_result = await db.execute(
        select(Person).where(Person.id == balance.person_id)
    )
    person = person_result.scalar_one_or_none()

    return AdminLeaveBalance(
        id=balance.id,
        person_id=balance.person_id,
        person_name=(
            f"{person.first_name} {person.last_name}".strip() if person else ""
        ),
        person_image=person.profile_image_url if person else None,
        leave_type_id=balance.leave_type_id,
        leave_type_name=balance.leave_type.name if balance.leave_type else "Unknown",
        leave_type_color=(
            balance.leave_type.color if balance.leave_type else "#176b4d"
        ),
        year=balance.year,
        total_days=_dec(balance.total_days),
        used_days=_dec(balance.used_days),
        pending_days=_dec(balance.pending_days),
        carry_over_days=_dec(balance.carry_over_days),
        remaining_days=(
            _dec(balance.total_days) - _dec(balance.used_days) - _dec(balance.pending_days)
        ),
    )


@router.post("/balances/ensure-year", response_model=dict)
async def ensure_balances_for_year(
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    """
    Idempotent bulk operation:
    For every active person and every active leave type with
    a default allocation, create a missing balance row.

    Useful at the start of a new leave year.
    Returns counts.
    """
    people_result = await db.execute(
        select(Person).where(
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
    )
    people = list(people_result.scalars().all())

    created_total = 0
    for person in people:
        created = await leave_service.ensure_balances_for_year(
            db,
            person_id=person.id,
            year=year,
        )
        created_total += len(created)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEAVE_BALANCES_BULK_CREATED",
        entity_type="leave_balance",
        entity_id="bulk",
        description=f"Bulk-created balances for year {year}",
        new_values={"created": created_total, "people_processed": len(people)},
    )

    await db.commit()

    return {
        "year": year,
        "people_processed": len(people),
        "balances_created": created_total,
    }


# ============================================================
# TEAM CALENDAR
# ============================================================

@router.get("/calendar", response_model=List[CalendarEntry])
async def team_leave_calendar(
    start: date = Query(...),
    end: date = Query(...),
    department: Optional[str] = None,
    leave_type_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """
    Approved leave overlapping the given date range.
    Used by the HR calendar view.
    """
    if end < start:
        raise HTTPException(status_code=400, detail="end must be after start")

    filters = [
        LeaveRequest.status == "approved",
        LeaveRequest.start_date <= end,
        LeaveRequest.end_date >= start,
    ]

    if leave_type_id:
        filters.append(LeaveRequest.leave_type_id == leave_type_id)

    if department:
        filters.append(
            LeaveRequest.person_id.in_(
                select(Person.id).where(
                    Person.department == department,
                    Person.deleted_at.is_(None),
                )
            )
        )

    result = await db.execute(
        select(LeaveRequest, Person)
        .options(selectinload(LeaveRequest.leave_type))
        .join(Person, Person.id == LeaveRequest.person_id)
        .where(*filters)
        .order_by(LeaveRequest.start_date)
    )
    rows = result.all()

    return [
        CalendarEntry(
            id=r.id,
            person_id=r.person_id,
            person_name=f"{p.first_name} {p.last_name}".strip(),
            person_image=p.profile_image_url,
            leave_type_name=r.leave_type.name if r.leave_type else "Unknown",
            leave_type_color=r.leave_type.color if r.leave_type else "#176b4d",
            start_date=r.start_date.isoformat(),
            end_date=r.end_date.isoformat(),
            total_days=_dec(r.total_days),
            status=r.status,
        )
        for r, p in rows
    ]
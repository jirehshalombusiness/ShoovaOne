from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.approval import ApprovalRequest
from app.models.sql.device import DeviceAssignment
from app.models.sql.document import Document
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.leave import LeaveBalance, LeaveRequest
from app.models.sql.public_holiday import PublicHoliday
from app.models.sql.user import Person, User
from app.services import leave_service
from app.services.audit_service import AuditService


router = APIRouter(prefix="/me", tags=["hr-me"])


# ============================================================
# HELPERS
# ============================================================

async def _require_person(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Person:
    """
    Resolve the authenticated user's Person record.

    Every /me endpoint depends on this. If a user account has no
    linked Person row, that is a data integrity problem and we
    refuse the request instead of silently returning empty data.
    """
    if not current_user.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not linked to an employee record",
        )

    result = await db.execute(
        select(Person).where(
            Person.id == current_user.person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Your employee record could not be found",
        )

    return person


def _iso(d) -> Optional[str]:
    if d is None:
        return None
    if isinstance(d, (datetime, date)):
        return d.isoformat()
    return str(d)


def _dec(value) -> float:
    if value is None:
        return 0.0
    return float(value)


# ============================================================
# SCHEMAS (inline — small enough to live here)
# ============================================================

class MeHomePerson(BaseModel):
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    profile_image_url: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None


class MeHomeBalance(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    year: int
    total_days: float
    used_days: float
    pending_days: float
    carry_over_days: float
    remaining_days: float


class MeHomeHoliday(BaseModel):
    id: str
    name: str
    holiday_date: str
    country: str
    is_paid: bool


class MeHomeLeaveRequest(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    start_date: str
    end_date: str
    total_days: float
    status: str
    created_at: str


class MeHomeApproval(BaseModel):
    id: str
    title: str
    entity_type: str
    due_at: Optional[str]
    created_at: str


class MeHomeResponse(BaseModel):
    person: MeHomePerson
    balances: List[MeHomeBalance]
    upcoming_holidays: List[MeHomeHoliday]
    recent_requests: List[MeHomeLeaveRequest]
    pending_approvals: List[MeHomeApproval]
    devices_count: int
    documents_pending: int


class MeProfileUpdate(BaseModel):
    """
    Fields a user can change directly on their own profile.

    Everything not in this schema must go through an approval
    request — see /me/profile/change-request (future).
    """
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    emergency_contact_name: Optional[str] = Field(None, max_length=200)
    emergency_contact_phone: Optional[str] = Field(None, max_length=50)
    emergency_contact_relationship: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=2000)
    profile_image_url: Optional[str] = None


# ============================================================
# GET /me/home
# ============================================================

@router.get("/home", response_model=MeHomeResponse)
async def get_my_home(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
    current_user: User = Depends(get_current_active_user),
):
    """
    Personal HR dashboard.

    Returns:
    - Person summary
    - This year's leave balances
    - Upcoming public holidays (next 90 days)
    - Recent leave requests (last 5)
    - Incoming approval requests (assigned to me)
    - Counts: active device assignments, documents awaiting verification
    """
    today = date.today()
    year = today.year

    # ---- balances ----
    balances = await leave_service.list_my_balances(
        db, person_id=person.id, year=year
    )

    # ---- upcoming holidays ----
    holidays_result = await db.execute(
        select(PublicHoliday)
        .where(
            PublicHoliday.holiday_date >= today,
            PublicHoliday.holiday_date <= today + timedelta(days=90),
        )
        .order_by(PublicHoliday.holiday_date)
        .limit(6)
    )
    holidays = list(holidays_result.scalars().all())

    # ---- recent leave requests ----
    recent_requests = await leave_service.list_my_leave_requests(
        db, person_id=person.id, limit=5
    )

    # ---- pending approvals assigned to me ----
    approvals_result = await db.execute(
        select(ApprovalRequest)
        .where(
            ApprovalRequest.assigned_to_id == person.id,
            ApprovalRequest.status == "pending",
        )
        .order_by(
            ApprovalRequest.due_at.asc().nullslast(),
            ApprovalRequest.created_at.desc(),
        )
        .limit(5)
    )
    pending_approvals = list(approvals_result.scalars().all())

    # ---- device count ----
    devices_result = await db.execute(
        select(func.count(DeviceAssignment.id)).where(
            DeviceAssignment.person_id == person.id,
            DeviceAssignment.returned_at.is_(None),
        )
    )
    devices_count = devices_result.scalar() or 0

    # ---- documents awaiting verification ----
    docs_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.related_entity_type == "person",
            Document.related_entity_id == person.id,
            Document.deleted_at.is_(None),
            or_(
                Document.verified.is_(False),
                Document.verified.is_(None),
            ),
        )
    )
    documents_pending = docs_result.scalar() or 0

    # ---- assemble ----
    return MeHomeResponse(
        person=MeHomePerson(
            id=person.id,
            first_name=person.first_name,
            last_name=person.last_name,
            job_title=person.job_title,
            profile_image_url=person.profile_image_url,
            department=None,  # set once Person.department exists
            location=person.location,
        ),
        balances=[
            MeHomeBalance(
                id=b.id,
                leave_type_id=b.leave_type_id,
                leave_type_name=b.leave_type.name if b.leave_type else "Unknown",
                leave_type_color=b.leave_type.color if b.leave_type else "#176b4d",
                year=b.year,
                total_days=_dec(b.total_days),
                used_days=_dec(b.used_days),
                pending_days=_dec(b.pending_days),
                carry_over_days=_dec(b.carry_over_days),
                remaining_days=(
                    _dec(b.total_days)
                    - _dec(b.used_days)
                    - _dec(b.pending_days)
                ),
            )
            for b in balances
        ],
        upcoming_holidays=[
            MeHomeHoliday(
                id=h.id,
                name=h.name,
                holiday_date=h.holiday_date.isoformat(),
                country=h.country,
                is_paid=h.is_paid,
            )
            for h in holidays
        ],
        recent_requests=[
            MeHomeLeaveRequest(
                id=r.id,
                leave_type_id=r.leave_type_id,
                leave_type_name=r.leave_type.name if r.leave_type else "Unknown",
                leave_type_color=r.leave_type.color if r.leave_type else "#176b4d",
                start_date=r.start_date.isoformat(),
                end_date=r.end_date.isoformat(),
                total_days=_dec(r.total_days),
                status=r.status,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
            for r in recent_requests
        ],
        pending_approvals=[
            MeHomeApproval(
                id=a.id,
                title=a.title,
                entity_type=a.entity_type,
                due_at=a.due_at.isoformat() if a.due_at else None,
                created_at=a.created_at.isoformat() if a.created_at else "",
            )
            for a in pending_approvals
        ],
        devices_count=devices_count,
        documents_pending=documents_pending,
    )

# ============================================================
# TIME OFF — READ
# ============================================================

class MeBalance(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_code: str
    leave_type_color: str
    is_paid: bool
    year: int
    total_days: float
    used_days: float
    pending_days: float
    carry_over_days: float
    remaining_days: float


class MeLeaveType(BaseModel):
    id: str
    name: str
    code: str
    default_days: int
    is_paid: bool
    color: str
    requires_documentation: bool
    is_active: bool


class MeLeaveRequest(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    start_date: str
    end_date: str
    total_days: float
    reason: Optional[str]
    status: str
    approved_at: Optional[str]
    rejection_reason: Optional[str]
    created_at: str
    approval_id: Optional[str] = None


class MeLeaveRequestCreate(BaseModel):
    leave_type_id: str
    start_date: date
    end_date: date
    reason: Optional[str] = Field(None, max_length=2000)
    attachment_ids: Optional[List[str]] = Field(default_factory=list)

    @field_validator("end_date")
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("end_date must be on or after start_date")
        return v


@router.get("/time-off/balances", response_model=List[MeBalance])
async def get_my_balances(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    My leave balances for the given year.

    Defaults to the current calendar year.
    """
    if year is None:
        year = date.today().year

    balances = await leave_service.list_my_balances(
        db, person_id=person.id, year=year
    )

    return [
        MeBalance(
            id=b.id,
            leave_type_id=b.leave_type_id,
            leave_type_name=b.leave_type.name if b.leave_type else "Unknown",
            leave_type_code=b.leave_type.code if b.leave_type else "unknown",
            leave_type_color=b.leave_type.color if b.leave_type else "#176b4d",
            is_paid=bool(b.leave_type.is_paid) if b.leave_type else True,
            year=b.year,
            total_days=_dec(b.total_days),
            used_days=_dec(b.used_days),
            pending_days=_dec(b.pending_days),
            carry_over_days=_dec(b.carry_over_days),
            remaining_days=(
                _dec(b.total_days) - _dec(b.used_days) - _dec(b.pending_days)
            ),
        )
        for b in balances
    ]


@router.get("/time-off/types", response_model=List[MeLeaveType])
async def get_leave_types(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """All active leave types available to me."""
    result = await db.execute(
        select(LeaveType)
        .where(LeaveType.is_active.is_(True))
        .order_by(LeaveType.name)
    )
    types = list(result.scalars().all())

    return [
        MeLeaveType(
            id=t.id,
            name=t.name,
            code=t.code,
            default_days=t.default_days or 0,
            is_paid=bool(t.is_paid),
            color=t.color or "#176b4d",
            requires_documentation=bool(t.requires_documentation),
            is_active=bool(t.is_active),
        )
        for t in types
    ]


@router.get("/time-off/requests", response_model=List[MeLeaveRequest])
async def get_my_leave_requests(
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    My leave request history.

    Optional status filter: pending / approved / rejected / cancelled.
    """
    requests = await leave_service.list_my_leave_requests(
        db, person_id=person.id, limit=limit, offset=offset
    )

    if status_filter:
        requests = [r for r in requests if r.status == status_filter]

    # Pull linked approval ids so the UI can deep-link to the inbox item.
    approval_map: dict[str, str] = {}
    if requests:
        approval_result = await db.execute(
            select(ApprovalRequest.entity_id, ApprovalRequest.id).where(
                ApprovalRequest.entity_type == "leave_request",
                ApprovalRequest.entity_id.in_([r.id for r in requests]),
            )
        )
        approval_map = {row[0]: row[1] for row in approval_result.all()}

    return [
        MeLeaveRequest(
            id=r.id,
            leave_type_id=r.leave_type_id,
            leave_type_name=r.leave_type.name if r.leave_type else "Unknown",
            leave_type_color=r.leave_type.color if r.leave_type else "#176b4d",
            start_date=r.start_date.isoformat(),
            end_date=r.end_date.isoformat(),
            total_days=_dec(r.total_days),
            reason=r.reason,
            status=r.status,
            approved_at=r.approved_at.isoformat() if r.approved_at else None,
            rejection_reason=r.rejection_reason,
            created_at=r.created_at.isoformat() if r.created_at else "",
            approval_id=approval_map.get(r.id),
        )
        for r in requests
    ]


@router.get("/time-off/requests/{request_id}", response_model=MeLeaveRequest)
async def get_my_leave_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """Single leave request. Only the requester can fetch their own."""
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(
            LeaveRequest.id == request_id,
            LeaveRequest.person_id == person.id,
        )
    )
    leave_request = result.scalar_one_or_none()

    if not leave_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found",
        )

    approval_result = await db.execute(
        select(ApprovalRequest.id).where(
            ApprovalRequest.entity_type == "leave_request",
            ApprovalRequest.entity_id == leave_request.id,
        )
    )
    approval_id = approval_result.scalar_one_or_none()

    return MeLeaveRequest(
        id=leave_request.id,
        leave_type_id=leave_request.leave_type_id,
        leave_type_name=(
            leave_request.leave_type.name if leave_request.leave_type else "Unknown"
        ),
        leave_type_color=(
            leave_request.leave_type.color if leave_request.leave_type else "#176b4d"
        ),
        start_date=leave_request.start_date.isoformat(),
        end_date=leave_request.end_date.isoformat(),
        total_days=_dec(leave_request.total_days),
        reason=leave_request.reason,
        status=leave_request.status,
        approved_at=(
            leave_request.approved_at.isoformat()
            if leave_request.approved_at
            else None
        ),
        rejection_reason=leave_request.rejection_reason,
        created_at=(
            leave_request.created_at.isoformat()
            if leave_request.created_at
            else ""
        ),
        approval_id=approval_id,
    )


# ============================================================
# TIME OFF — CREATE
# ============================================================

@router.post(
    "/time-off/requests",
    response_model=MeLeaveRequest,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_leave_request(
    payload: MeLeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
    current_user: User = Depends(get_current_active_user),
):
    """
    Submit a new leave request.

    Side effects, all in one transaction:
    - LeaveRequest created (status=pending)
    - LeaveBalance.pending_days incremented
    - ApprovalRequest created and routed to the approver
    - Audit log entry written

    All validation errors surface as 400/409 with a human message.
    """
    leave_request = await leave_service.create_leave_request(
        db=db,
        actor=current_user,
        leave_type_id=payload.leave_type_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        attachment_ids=payload.attachment_ids or None,
    )

    await db.commit()
    await db.refresh(leave_request)

    # Reload with relationships for the response.
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.id == leave_request.id)
    )
    leave_request = result.scalar_one()

    approval_result = await db.execute(
        select(ApprovalRequest.id).where(
            ApprovalRequest.entity_type == "leave_request",
            ApprovalRequest.entity_id == leave_request.id,
        )
    )
    approval_id = approval_result.scalar_one_or_none()

    return MeLeaveRequest(
        id=leave_request.id,
        leave_type_id=leave_request.leave_type_id,
        leave_type_name=(
            leave_request.leave_type.name if leave_request.leave_type else "Unknown"
        ),
        leave_type_color=(
            leave_request.leave_type.color if leave_request.leave_type else "#176b4d"
        ),
        start_date=leave_request.start_date.isoformat(),
        end_date=leave_request.end_date.isoformat(),
        total_days=_dec(leave_request.total_days),
        reason=leave_request.reason,
        status=leave_request.status,
        approved_at=None,
        rejection_reason=None,
        created_at=(
            leave_request.created_at.isoformat()
            if leave_request.created_at
            else ""
        ),
        approval_id=approval_id,
    )


# ============================================================
# TIME OFF — CANCEL
# ============================================================

@router.post(
    "/time-off/requests/{request_id}/cancel",
    response_model=MeLeaveRequest,
)
async def cancel_my_leave_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
    current_user: User = Depends(get_current_active_user),
):
    """
    Withdraw a pending leave request.

    Balance.pending_days is released and the linked approval
    request is marked cancelled.
    """
    leave_request = await leave_service.cancel_leave_request(
        db=db,
        actor=current_user,
        leave_request_id=request_id,
    )

    await db.commit()
    await db.refresh(leave_request)

    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.id == leave_request.id)
    )
    leave_request = result.scalar_one()

    approval_result = await db.execute(
        select(ApprovalRequest.id).where(
            ApprovalRequest.entity_type == "leave_request",
            ApprovalRequest.entity_id == leave_request.id,
        )
    )
    approval_id = approval_result.scalar_one_or_none()

    return MeLeaveRequest(
        id=leave_request.id,
        leave_type_id=leave_request.leave_type_id,
        leave_type_name=(
            leave_request.leave_type.name if leave_request.leave_type else "Unknown"
        ),
        leave_type_color=(
            leave_request.leave_type.color if leave_request.leave_type else "#176b4d"
        ),
        start_date=leave_request.start_date.isoformat(),
        end_date=leave_request.end_date.isoformat(),
        total_days=_dec(leave_request.total_days),
        reason=leave_request.reason,
        status=leave_request.status,
        approved_at=(
            leave_request.approved_at.isoformat()
            if leave_request.approved_at
            else None
        ),
        rejection_reason=leave_request.rejection_reason,
        created_at=(
            leave_request.created_at.isoformat()
            if leave_request.created_at
            else ""
        ),
        approval_id=approval_id,
    )


# ============================================================
# TIME OFF — HOLIDAYS
# ============================================================

class MeHoliday(BaseModel):
    id: str
    name: str
    holiday_date: str
    country: str
    is_paid: bool


@router.get("/time-off/holidays", response_model=List[MeHoliday])
async def get_my_upcoming_holidays(
    days_ahead: int = 365,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """Upcoming public holidays for the org."""
    today = date.today()

    result = await db.execute(
        select(PublicHoliday)
        .where(
            PublicHoliday.holiday_date >= today,
            PublicHoliday.holiday_date <= today + timedelta(days=days_ahead),
        )
        .order_by(PublicHoliday.holiday_date)
    )
    holidays = list(result.scalars().all())

    return [
        MeHoliday(
            id=h.id,
            name=h.name,
            holiday_date=h.holiday_date.isoformat(),
            country=h.country,
            is_paid=bool(h.is_paid),
        )
        for h in holidays
    ]


# ============================================================
# TIME OFF — APPROVALS PREVIEW
# ============================================================

class MeApprovalItem(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    title: str
    summary: Optional[str] = None
    priority: str
    status: str
    due_at: Optional[str]
    created_at: str
    requested_by_id: str
    requested_by_name: str
    requested_by_image: Optional[str] = None
    assigned_to_id: Optional[str]
    assigned_to_name: Optional[str] = None


@router.get("/approvals", response_model=List[MeApprovalItem])
async def get_my_pending_approvals(
    status_filter: str = "pending",
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    Approvals currently assigned to me.

    This is a lightweight preview that powers the sidebar badge and
    the dashboard widget. The full inbox lives at /hr/approvals.
    """
    result = await db.execute(
        select(ApprovalRequest)
        .options(
            selectinload(ApprovalRequest.requested_by),
            selectinload(ApprovalRequest.assigned_to),
        )
        .where(
            ApprovalRequest.assigned_to_id == person.id,
            ApprovalRequest.status == status_filter,
        )
        .order_by(
            ApprovalRequest.priority.desc(),
            ApprovalRequest.due_at.asc().nullslast(),
            ApprovalRequest.created_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    rows = list(result.scalars().all())

    def _name(p: Optional[Person]) -> str:
        if not p:
            return "Unknown"
        return f"{p.first_name} {p.last_name}".strip()

    return [
        MeApprovalItem(
            id=a.id,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            title=a.title,
            summary=a.summary,
            priority=a.priority,
            status=a.status,
            due_at=a.due_at.isoformat() if a.due_at else None,
            created_at=a.created_at.isoformat() if a.created_at else "",
            requested_by_id=a.requested_by_id,
            requested_by_name=_name(a.requested_by),
            requested_by_image=(
                a.requested_by.profile_image_url if a.requested_by else None
            ),
            assigned_to_id=a.assigned_to_id,
            assigned_to_name=_name(a.assigned_to) if a.assigned_to else None,
        )
        for a in rows
    ]

# ============================================================
# GET /me/profile
# ============================================================

class MeProfileResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    preferred_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    type: str
    status: str
    profile_image_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None


@router.get("/profile", response_model=MeProfileResponse)
async def get_my_profile(
    person: Person = Depends(_require_person),
):
    """
    Return my own person record.

    Read-only here. Use PATCH /me/profile to change the safe subset
    of fields. Structural fields (name, job title, reporting line,
    employment type) require an approval request.
    """
    return MeProfileResponse(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        date_of_birth=_iso(person.date_of_birth),
        gender=person.gender,
        job_title=person.job_title,
        location=person.location,
        employment_type=person.employment_type,
        type=person.type,
        status=person.status or "active",
        profile_image_url=person.profile_image_url,
        address=person.address,
        city=person.city,
        state=person.state,
        country=person.country,
        postal_code=person.postal_code,
        emergency_contact_name=person.emergency_contact_name,
        emergency_contact_phone=person.emergency_contact_phone,
        emergency_contact_relationship=person.emergency_contact_relationship,
        bio=person.bio,
        skills=person.skills,
    )


# ============================================================
# PATCH /me/profile
# ============================================================

@router.patch("/profile", response_model=MeProfileResponse)
async def update_my_profile(
    payload: MeProfileUpdate,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update the safe subset of my own profile fields.

    Any field not in MeProfileUpdate must go through an approval
    request. This endpoint silently ignores extraneous keys —
    FastAPI strips them via response_model.
    """
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes supplied",
        )

    old_values = {}
    new_values = {}

    for key, value in changes.items():
        old_values[key] = _iso(getattr(person, key, None))
        setattr(person, key, value)
        new_values[key] = _iso(value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROFILE_SELF_UPDATED",
        entity_type="person",
        entity_id=person.id,
        description="Updated own profile",
        old_values=old_values,
        new_values=new_values,
    )

    await db.commit()
    await db.refresh(person)

    return MeProfileResponse(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        date_of_birth=_iso(person.date_of_birth),
        gender=person.gender,
        job_title=person.job_title,
        location=person.location,
        employment_type=person.employment_type,
        type=person.type,
        status=person.status or "active",
        profile_image_url=person.profile_image_url,
        address=person.address,
        city=person.city,
        state=person.state,
        country=person.country,
        postal_code=person.postal_code,
        emergency_contact_name=person.emergency_contact_name,
        emergency_contact_phone=person.emergency_contact_phone,
        emergency_contact_relationship=person.emergency_contact_relationship,
        bio=person.bio,
        skills=person.skills,
    )


# ============================================================
# GET /me/org
# ============================================================

class MeOrgPerson(BaseModel):
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    profile_image_url: Optional[str] = None
    location: Optional[str] = None


class MeOrgResponse(BaseModel):
    me: MeOrgPerson
    manager: Optional[MeOrgPerson] = None
    direct_reports: List[MeOrgPerson] = []
    contract_summary: Optional[dict] = None


@router.get("/org", response_model=MeOrgResponse)
async def get_my_org_position(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    My immediate org context:
    - my manager
    - my direct reports
    - my current contract summary (position, department, start date)
    """
    # manager
    manager: Optional[Person] = None
    if person.reports_to_id:
        result = await db.execute(
            select(Person).where(Person.id == person.reports_to_id)
        )
        manager = result.scalar_one_or_none()

    # direct reports
    reports_result = await db.execute(
        select(Person)
        .where(
            Person.reports_to_id == person.id,
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
        .order_by(Person.first_name)
    )
    direct_reports = list(reports_result.scalars().all())

    # current contract
    contract_result = await db.execute(
        select(EmploymentContract)
        .where(
            EmploymentContract.person_id == person.id,
            EmploymentContract.is_current.is_(True),
        )
        .limit(1)
    )
    contract = contract_result.scalar_one_or_none()

    def _to_org(p: Person) -> MeOrgPerson:
        return MeOrgPerson(
            id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            job_title=p.job_title,
            profile_image_url=p.profile_image_url,
            location=p.location,
        )

    return MeOrgResponse(
        me=_to_org(person),
        manager=_to_org(manager) if manager else None,
        direct_reports=[_to_org(r) for r in direct_reports],
        contract_summary=(
            {
                "contract_type": contract.contract_type,
                "position": contract.position,
                "department": contract.department,
                "start_date": contract.start_date.isoformat(),
                "end_date": (
                    contract.end_date.isoformat()
                    if contract.end_date
                    else None
                ),
            }
            if contract
            else None
        ),
    )

# ============================================================
# DEVICES
# ============================================================

class MeDevice(BaseModel):
    id: str
    assignment_id: str
    name: str
    category: str
    serial_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    condition: str
    assigned_at: Optional[str] = None


@router.get("/devices", response_model=List[MeDevice])
async def get_my_devices(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    Devices currently assigned to me.

    Only returns assignments that have not been returned
    (returned_at is null).
    """
    from app.models.sql.device import DeviceAssignment

    result = await db.execute(
        select(DeviceAssignment)
        .options(selectinload(DeviceAssignment.device))
        .where(
            DeviceAssignment.person_id == person.id,
            DeviceAssignment.returned_at.is_(None),
        )
        .order_by(DeviceAssignment.assigned_at.desc())
    )
    assignments = list(result.scalars().all())

    return [
        MeDevice(
            id=a.device.id if a.device else "",
            assignment_id=a.id,
            name=a.device.name if a.device else "",
            category=a.device.category if a.device else "",
            serial_number=a.device.serial_number if a.device else None,
            brand=a.device.brand if a.device else None,
            model=a.device.model if a.device else None,
            condition=a.device.condition if a.device else "good",
            assigned_at=(
                a.assigned_at.isoformat()
                if a.assigned_at
                else None
            ),
        )
        for a in assignments
    ]


# ============================================================
# CONTRACTS
# ============================================================

class MeContract(BaseModel):
    id: str
    contract_type: str
    position: Optional[str] = None
    department: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    reports_to_id: Optional[str] = None
    reports_to_name: Optional[str] = None
    compensation_amount: Optional[float] = None
    compensation_currency: Optional[str] = None
    compensation_frequency: Optional[str] = None
    document_id: Optional[str] = None
    is_current: bool


@router.get("/contracts", response_model=List[MeContract])
async def get_my_contracts(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    All my employment contracts, current first, then historical.
    """
    result = await db.execute(
        select(EmploymentContract)
        .options(selectinload(EmploymentContract.reports_to))
        .where(EmploymentContract.person_id == person.id)
        .order_by(
            EmploymentContract.is_current.desc(),
            EmploymentContract.start_date.desc(),
        )
    )
    contracts = list(result.scalars().all())

    def _name(p: Optional[Person]) -> Optional[str]:
        if not p:
            return None
        return f"{p.first_name} {p.last_name}".strip()

    return [
        MeContract(
            id=c.id,
            contract_type=c.contract_type,
            position=c.position,
            department=c.department,
            start_date=c.start_date.isoformat(),
            end_date=c.end_date.isoformat() if c.end_date else None,
            reports_to_id=c.reports_to_id,
            reports_to_name=_name(c.reports_to),
            compensation_amount=(
                float(c.compensation_amount)
                if c.compensation_amount is not None
                else None
            ),
            compensation_currency=c.compensation_currency,
            compensation_frequency=c.compensation_frequency,
            document_id=c.document_id,
            is_current=bool(c.is_current),
        )
        for c in contracts
    ]
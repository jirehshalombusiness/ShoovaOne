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
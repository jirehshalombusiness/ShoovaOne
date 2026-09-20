from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import select, or_, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.leave import LeaveBalance, LeaveRequest
from app.models.sql.device import DeviceAssignment
from app.models.sql.document import Document
from app.models.sql.hr_note import HRNote
from app.models.sql.project import Project, ProjectMember, Task
from app.models.sql.audit_log import AuditLog
from app.models.sql.approval import ApprovalRequest
from app.services import approval_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# FIELDS
# ============================================================

# Fields that require an approval request when changed.
# Everything not in this set can be edited directly by HR.
STRUCTURAL_FIELDS = {
    "job_title",
    "department",
    "employment_type",
    "reports_to_id",
    "status",
    "type",
}

# Fields that HR can always edit directly (contact + admin).
INSTANT_FIELDS = {
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "gender",
    "location",
    "employee_number",
    "profile_image_url",
    "address",
    "city",
    "state",
    "country",
    "postal_code",
    "emergency_contact_name",
    "emergency_contact_phone",
    "emergency_contact_relationship",
    "bio",
    "skills",
}


# ============================================================
# SCHEMAS
# ============================================================

class EmployeeListItem(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    type: str
    status: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    employee_number: Optional[str] = None
    profile_image_url: Optional[str] = None
    reports_to_id: Optional[str] = None
    reports_to_name: Optional[str] = None


class EmployeeListResponse(BaseModel):
    items: List[EmployeeListItem]
    total: int


class EmployeePerson(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    type: str
    status: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    employee_number: Optional[str] = None
    reports_to_id: Optional[str] = None
    reports_to_name: Optional[str] = None
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
    created_at: str
    updated_at: Optional[str] = None


class ContractItem(BaseModel):
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


class LeaveBalanceItem(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    year: int
    total_days: float
    used_days: float
    pending_days: float
    remaining_days: float


class DeviceItem(BaseModel):
    assignment_id: str
    device_id: str
    name: str
    category: str
    serial_number: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    condition: Optional[str] = None
    assigned_at: Optional[str] = None


class DocumentItem(BaseModel):
    id: str
    name: str
    file_url: str
    mime_type: Optional[str] = None
    verified: bool
    expiry_date: Optional[str] = None
    created_at: str


class NoteItem(BaseModel):
    id: str
    category: str
    title: Optional[str] = None
    content: str
    is_sensitive: bool
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    created_at: str
    updated_at: Optional[str] = None


class ProjectItem(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    status: str
    role: Optional[str] = None


class TaskItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    due_date: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None


class OrgNeighbor(BaseModel):
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    profile_image_url: Optional[str] = None


class EmployeeDetail(BaseModel):
    person: EmployeePerson
    contracts: List[ContractItem] = []
    leave_balances: List[LeaveBalanceItem] = []
    devices: List[DeviceItem] = []
    documents: List[DocumentItem] = []
    notes: List[NoteItem] = []
    projects: List[ProjectItem] = []
    tasks: List[TaskItem] = []
    manager: Optional[OrgNeighbor] = None
    direct_reports: List[OrgNeighbor] = []


class EmployeeUpdate(BaseModel):
    """
    Update payload for HR.
    Contact/emergency/bio fields edit instantly.
    Structural fields (job_title, department, reports_to_id, etc.)
    are written to an ApprovalRequest instead of being applied.
    """
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    employee_number: Optional[str] = None
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

    # Structural (require approval)
    job_title: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    reports_to_id: Optional[str] = None
    status: Optional[str] = None
    type: Optional[str] = None


class EmployeeUpdateResponse(BaseModel):
    applied: dict
    pending_approval_id: Optional[str] = None
    pending_fields: List[str] = []


class NoteCreate(BaseModel):
    category: str = Field("general", max_length=50)
    title: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., min_length=1, max_length=10000)
    is_sensitive: bool = True


class NoteUpdate(BaseModel):
    category: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, min_length=1, max_length=10000)
    is_sensitive: Optional[bool] = None


class TerminateRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=2000)
    last_working_day: Optional[date] = None
    deactivate_user: bool = True


class EmployeeStats(BaseModel):
    total: int
    active: int
    inactive: int
    by_type: dict
    by_status: dict
    by_department: dict


class TimelineEntry(BaseModel):
    id: str
    action: str
    description: Optional[str] = None
    entity_type: str
    entity_id: str
    actor_name: Optional[str] = None
    actor_image: Optional[str] = None
    created_at: str


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


async def _load_person(
    db: AsyncSession,
    person_id: str,
    *,
    allow_deleted: bool = False,
) -> Person:
    query = select(Person).where(Person.id == person_id)
    if not allow_deleted:
        query = query.where(Person.deleted_at.is_(None))
    result = await db.execute(query)
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Employee not found")
    return person


async def _manager_name(db: AsyncSession, reports_to_id: Optional[str]) -> Optional[str]:
    if not reports_to_id:
        return None
    result = await db.execute(
        select(Person).where(Person.id == reports_to_id)
    )
    manager = result.scalar_one_or_none()
    return _person_name(manager)


async def _can_manage_approval_flows(
    db: AsyncSession,
    person_id: str,
) -> bool:
    """True if the actor is HR approver or higher."""
    return await approval_service._person_has_any_role(
        db,
        person_id,
        approval_service.HR_APPROVER_ROLES,
    )


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    search: Optional[str] = Query(None, min_length=1),
    type_filter: Optional[str] = Query(None, alias="type"),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Employee list. Requires hr.view_sensitive.
    """
    filters = [
        Person.deleted_at.is_(None),
        Person.type.in_(["staff", "volunteer"]),
    ]

    if search:
        pattern = f"%{search}%"
        filters.append(
            or_(
                Person.first_name.ilike(pattern),
                Person.last_name.ilike(pattern),
                Person.email.ilike(pattern),
                Person.employee_number.ilike(pattern),
            )
        )

    if type_filter:
        filters.append(Person.type == type_filter)

    if status_filter:
        filters.append(Person.status == status_filter)

    if department:
        filters.append(Person.department == department)

    count_result = await db.execute(
        select(func.count(Person.id)).where(*filters)
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Person)
        .where(*filters)
        .order_by(Person.first_name, Person.last_name)
        .offset(offset)
        .limit(limit)
    )
    people = list(result.scalars().all())

    # Preload all managers referenced by these people.
    manager_ids = {p.reports_to_id for p in people if p.reports_to_id}
    managers: dict[str, str] = {}
    if manager_ids:
        mgr_result = await db.execute(
            select(Person.id, Person.first_name, Person.last_name).where(
                Person.id.in_(list(manager_ids))
            )
        )
        for row in mgr_result.all():
            managers[row[0]] = f"{row[1]} {row[2]}".strip()

    return EmployeeListResponse(
        items=[
            EmployeeListItem(
                id=p.id,
                first_name=p.first_name,
                last_name=p.last_name,
                email=p.email,
                phone=p.phone,
                type=p.type,
                status=p.status,
                job_title=p.job_title,
                department=p.department,
                location=p.location,
                employment_type=p.employment_type,
                employee_number=p.employee_number,
                profile_image_url=p.profile_image_url,
                reports_to_id=p.reports_to_id,
                reports_to_name=managers.get(p.reports_to_id) if p.reports_to_id else None,
            )
            for p in people
        ],
        total=total,
    )


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=EmployeeStats)
async def employee_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """Counts by type / status / department for the HR dashboard."""

    async def _group(col, extra_filter=None):
        q = select(col, func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.type.in_(["staff", "volunteer"]),
        )
        if extra_filter is not None:
            q = q.where(extra_filter)
        q = q.group_by(col)
        result = await db.execute(q)
        return {row[0] or "unknown": row[1] for row in result.all()}

    total_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.type.in_(["staff", "volunteer"]),
        )
    )
    total = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.status == "active",
            Person.type.in_(["staff", "volunteer"]),
        )
    )
    active = active_result.scalar() or 0

    return EmployeeStats(
        total=total,
        active=active,
        inactive=total - active,
        by_type=await _group(Person.type),
        by_status=await _group(Person.status),
        by_department=await _group(Person.department),
    )


# ============================================================
# DETAIL
# ============================================================

@router.get("/{person_id}", response_model=EmployeeDetail)
async def get_employee_detail(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Full HR detail for a single employee.

    Requires hr.view_sensitive.
    """
    person = await _load_person(db, person_id)

    # ---- contracts ----
    contracts_result = await db.execute(
        select(EmploymentContract)
        .options(selectinload(EmploymentContract.reports_to))
        .where(EmploymentContract.person_id == person.id)
        .order_by(EmploymentContract.start_date.desc())
    )
    contracts = list(contracts_result.scalars().all())

    # ---- leave balances (this year) ----
    year = date.today().year
    balances_result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.person_id == person.id,
            LeaveBalance.year == year,
        )
    )
    balances = list(balances_result.scalars().all())

    # ---- devices ----
    devices_result = await db.execute(
        select(DeviceAssignment)
        .options(selectinload(DeviceAssignment.device))
        .where(
            DeviceAssignment.person_id == person.id,
            DeviceAssignment.returned_at.is_(None),
        )
        .order_by(DeviceAssignment.assigned_at.desc())
    )
    assignments = list(devices_result.scalars().all())

    # ---- documents ----
    docs_result = await db.execute(
        select(Document)
        .where(
            Document.related_entity_type == "person",
            Document.related_entity_id == person.id,
            Document.deleted_at.is_(None),
        )
        .order_by(Document.created_at.desc())
    )
    documents = list(docs_result.scalars().all())

    # ---- notes ----
    notes_result = await db.execute(
        select(HRNote)
        .options(selectinload(HRNote.author))
        .where(HRNote.person_id == person.id)
        .order_by(HRNote.created_at.desc())
    )
    notes = list(notes_result.scalars().all())

    # ---- projects ----
    projects_result = await db.execute(
        select(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.person_id == person.id)
    )
    projects = [
        ProjectItem(
            id=row[0].id,
            name=row[0].name,
            code=row[0].code,
            status=row[0].status,
            role=row[1],
        )
        for row in projects_result.all()
    ]

    # ---- open tasks ----
    tasks_result = await db.execute(
        select(Task)
        .where(
            Task.assignee_id == person.id,
            Task.status.notin_(["done", "cancelled"]),
        )
        .order_by(Task.due_date.asc().nullslast())
        .limit(30)
    )
    tasks = list(tasks_result.scalars().all())

    # ---- manager + direct reports ----
    manager: Optional[OrgNeighbor] = None
    if person.reports_to_id:
        mgr_result = await db.execute(
            select(Person).where(Person.id == person.reports_to_id)
        )
        mgr = mgr_result.scalar_one_or_none()
        if mgr:
            manager = OrgNeighbor(
                id=mgr.id,
                first_name=mgr.first_name,
                last_name=mgr.last_name,
                job_title=mgr.job_title,
                profile_image_url=mgr.profile_image_url,
            )

    reports_result = await db.execute(
        select(Person)
        .where(
            Person.reports_to_id == person.id,
            Person.deleted_at.is_(None),
        )
        .order_by(Person.first_name)
    )
    direct_reports = [
        OrgNeighbor(
            id=r.id,
            first_name=r.first_name,
            last_name=r.last_name,
            job_title=r.job_title,
            profile_image_url=r.profile_image_url,
        )
        for r in reports_result.scalars().all()
    ]

    return EmployeeDetail(
        person=EmployeePerson(
            id=person.id,
            first_name=person.first_name,
            last_name=person.last_name,
            email=person.email,
            phone=person.phone,
            date_of_birth=_iso(person.date_of_birth),
            gender=person.gender,
            type=person.type,
            status=person.status,
            job_title=person.job_title,
            department=person.department,
            location=person.location,
            employment_type=person.employment_type,
            employee_number=person.employee_number,
            reports_to_id=person.reports_to_id,
            reports_to_name=_person_name(mgr) if manager else None,
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
            created_at=person.created_at.isoformat() if person.created_at else "",
            updated_at=_iso(person.updated_at),
        ),
        contracts=[
            ContractItem(
                id=c.id,
                contract_type=c.contract_type,
                position=c.position,
                department=c.department,
                start_date=c.start_date.isoformat(),
                end_date=_iso(c.end_date),
                reports_to_id=c.reports_to_id,
                reports_to_name=_person_name(c.reports_to),
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
        ],
        leave_balances=[
            LeaveBalanceItem(
                id=b.id,
                leave_type_id=b.leave_type_id,
                leave_type_name=b.leave_type.name if b.leave_type else "Unknown",
                leave_type_color=b.leave_type.color if b.leave_type else "#176b4d",
                year=b.year,
                total_days=_dec(b.total_days),
                used_days=_dec(b.used_days),
                pending_days=_dec(b.pending_days),
                remaining_days=(
                    _dec(b.total_days) - _dec(b.used_days) - _dec(b.pending_days)
                ),
            )
            for b in balances
        ],
        devices=[
            DeviceItem(
                assignment_id=a.id,
                device_id=a.device.id if a.device else "",
                name=a.device.name if a.device else "",
                category=a.device.category if a.device else "",
                serial_number=a.device.serial_number if a.device else None,
                brand=a.device.brand if a.device else None,
                model=a.device.model if a.device else None,
                condition=a.device.condition if a.device else None,
                assigned_at=_iso(a.assigned_at),
            )
            for a in assignments
        ],
        documents=[
            DocumentItem(
                id=d.id,
                name=d.name,
                file_url=d.file_url,
                mime_type=d.mime_type,
                verified=bool(d.verified),
                expiry_date=_iso(d.expiry_date),
                created_at=d.created_at.isoformat() if d.created_at else "",
            )
            for d in documents
        ],
        notes=[
            NoteItem(
                id=n.id,
                category=n.category,
                title=n.title,
                content=n.content,
                is_sensitive=bool(n.is_sensitive),
                author_id=n.author_id,
                author_name=_person_name(n.author),
                created_at=n.created_at.isoformat() if n.created_at else "",
                updated_at=_iso(n.updated_at),
            )
            for n in notes
        ],
        projects=projects,
        tasks=[
            TaskItem(
                id=t.id,
                title=t.title,
                status=t.status,
                priority=t.priority,
                due_date=_iso(t.due_date),
                project_id=t.project_id,
                project_name=None,
            )
            for t in tasks
        ],
        manager=manager,
        direct_reports=direct_reports,
    )


# ============================================================
# UPDATE
# ============================================================

@router.patch("/{person_id}", response_model=EmployeeUpdateResponse)
async def update_employee(
    person_id: str,
    payload: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    """
    Update an employee.

    Contact/admin fields are applied directly and audit-logged.
    Structural fields (job_title, department, reports_to_id,
    employment_type, status, type) create an ApprovalRequest
    routed to director / executive_director.

    Requires hr.edit_sensitive.
    """
    person = await _load_person(db, person_id)
    changes = payload.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")

    instant_changes = {k: v for k, v in changes.items() if k in INSTANT_FIELDS}
    structural_changes = {k: v for k, v in changes.items() if k in STRUCTURAL_FIELDS}
    unknown_fields = set(changes) - INSTANT_FIELDS - STRUCTURAL_FIELDS

    if unknown_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown or non-editable fields: {sorted(unknown_fields)}",
        )

    applied: dict = {}
    old_values: dict = {}

    # Apply instant changes
    for key, value in instant_changes.items():
        old_value = getattr(person, key, None)
        old_values[key] = _iso(old_value)
        setattr(person, key, value)
        applied[key] = _iso(value)

    # Audit instant changes
    if instant_changes:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="EMPLOYEE_UPDATED",
            entity_type="person",
            entity_id=person.id,
            description=f"HR updated {person.first_name} {person.last_name}",
            old_values=old_values,
            new_values=applied,
        )

    # Structural changes -> approval request
    pending_approval_id: Optional[str] = None
    pending_fields: List[str] = []

    if structural_changes:
        # Validate reports_to_id is real
        if "reports_to_id" in structural_changes and structural_changes["reports_to_id"]:
            target = structural_changes["reports_to_id"]
            if target == person.id:
                raise HTTPException(
                    status_code=400,
                    detail="An employee cannot report to themselves",
                )
            await _load_person(db, target)

        summary_lines = [f"{k}: {v!r}" for k, v in structural_changes.items()]
        approval = await approval_service.create_request(
            db=db,
            entity_type="employee_change",
            entity_id=person.id,
            requested_by_id=current_user.person_id,
            title=f"Update employee record: {person.first_name} {person.last_name}",
            summary="; ".join(summary_lines)[:1000],
            priority="normal",
            due_hours=72,
        )
        # Store the desired changes on the approval so the approver can see them.
        approval.summary = (
            (approval.summary or "")
            + " | payload="
            + str(structural_changes)[:1500]
        )
        pending_approval_id = approval.id
        pending_fields = sorted(structural_changes.keys())

    await db.commit()

    return EmployeeUpdateResponse(
        applied=applied,
        pending_approval_id=pending_approval_id,
        pending_fields=pending_fields,
    )


# ============================================================
# NOTES
# ============================================================

@router.post(
    "/{person_id}/notes",
    response_model=NoteItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    person_id: str,
    payload: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    person = await _load_person(db, person_id)

    note = HRNote(
        id=str(uuid.uuid4()),
        person_id=person.id,
        author_id=current_user.person_id,
        category=payload.category,
        title=payload.title,
        content=payload.content,
        is_sensitive=payload.is_sensitive,
    )
    db.add(note)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HR_NOTE_CREATED",
        entity_type="person",
        entity_id=person.id,
        description=f"Added HR note ({payload.category})",
        new_values={"category": payload.category, "title": payload.title},
    )

    await db.commit()
    await db.refresh(note)

    author_name = None
    if current_user.person_id:
        result = await db.execute(
            select(Person).where(Person.id == current_user.person_id)
        )
        author = result.scalar_one_or_none()
        author_name = _person_name(author)

    return NoteItem(
        id=note.id,
        category=note.category,
        title=note.title,
        content=note.content,
        is_sensitive=bool(note.is_sensitive),
        author_id=note.author_id,
        author_name=author_name,
        created_at=note.created_at.isoformat() if note.created_at else "",
        updated_at=_iso(note.updated_at),
    )


@router.patch("/{person_id}/notes/{note_id}", response_model=NoteItem)
async def update_note(
    person_id: str,
    note_id: str,
    payload: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    result = await db.execute(
        select(HRNote).where(
            HRNote.id == note_id,
            HRNote.person_id == person_id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(note, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HR_NOTE_UPDATED",
        entity_type="person",
        entity_id=person_id,
        description=f"Updated HR note {note_id}",
        new_values=changes,
    )

    await db.commit()
    await db.refresh(note)

    return NoteItem(
        id=note.id,
        category=note.category,
        title=note.title,
        content=note.content,
        is_sensitive=bool(note.is_sensitive),
        author_id=note.author_id,
        author_name=None,
        created_at=note.created_at.isoformat() if note.created_at else "",
        updated_at=_iso(note.updated_at),
    )


@router.delete(
    "/{person_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_note(
    person_id: str,
    note_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    result = await db.execute(
        select(HRNote).where(
            HRNote.id == note_id,
            HRNote.person_id == person_id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await db.delete(note)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HR_NOTE_DELETED",
        entity_type="person",
        entity_id=person_id,
        description=f"Deleted HR note {note_id}",
    )

    await db.commit()
    return None


# ============================================================
# TERMINATE
# ============================================================

@router.post("/{person_id}/terminate", response_model=EmployeePerson)
async def terminate_employee(
    person_id: str,
    payload: TerminateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    """
    Terminate an employee.

    Side effects, single transaction:
    - Person.status = "terminated"
    - Person.deleted_at = now()
    - Current EmploymentContract closed (is_current=false, end_date=today)
    - User account deactivated if deactivate_user=True
    - Audit log entry
    """
    person = await _load_person(db, person_id)

    last_day = payload.last_working_day or date.today()

    # Close current contract
    contracts_result = await db.execute(
        select(EmploymentContract).where(
            EmploymentContract.person_id == person.id,
            EmploymentContract.is_current.is_(True),
        )
    )
    current_contract = contracts_result.scalar_one_or_none()
    if current_contract:
        current_contract.is_current = False
        if not current_contract.end_date:
            current_contract.end_date = last_day

    # Deactivate user account
    if payload.deactivate_user:
        user_result = await db.execute(
            select(User).where(User.person_id == person.id)
        )
        user = user_result.scalar_one_or_none()
        if user:
            user.is_active = False

    # Flip person status
    person.status = "terminated"
    person.deleted_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="EMPLOYEE_TERMINATED",
        entity_type="person",
        entity_id=person.id,
        description=f"Terminated {person.first_name} {person.last_name}",
        new_values={
            "status": "terminated",
            "reason": payload.reason,
            "last_working_day": last_day.isoformat(),
            "user_deactivated": payload.deactivate_user,
        },
    )

    await db.commit()
    await db.refresh(person)

    return EmployeePerson(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        phone=person.phone,
        date_of_birth=_iso(person.date_of_birth),
        gender=person.gender,
        type=person.type,
        status=person.status,
        job_title=person.job_title,
        department=person.department,
        location=person.location,
        employment_type=person.employment_type,
        employee_number=person.employee_number,
        reports_to_id=person.reports_to_id,
        reports_to_name=None,
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
        created_at=person.created_at.isoformat() if person.created_at else "",
        updated_at=_iso(person.updated_at),
    )


# ============================================================
# TIMELINE
# ============================================================

@router.get("/{person_id}/timeline", response_model=List[TimelineEntry])
async def get_employee_timeline(
    person_id: str,
    limit: int = Query(100, ge=1, le=300),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Unified activity feed for a person, drawn from the audit log.
    """
    result = await db.execute(
        select(AuditLog)
        .options(selectinload(AuditLog.actor))
        .where(
            AuditLog.entity_type.in_(["person", "employee_change"]),
            AuditLog.entity_id == person_id,
        )
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = list(result.scalars().all())

    return [
        TimelineEntry(
            id=log.id,
            action=log.action,
            description=log.description,
            entity_type=log.entity_type,
            entity_id=str(log.entity_id),
            actor_name=_person_name(log.actor),
            actor_image=log.actor.profile_image_url if log.actor else None,
            created_at=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]
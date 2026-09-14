from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import date, datetime, timedelta
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import Person
from app.models.sql.document import Document
from app.models.sql.document_type import DocumentType
from app.models.sql.hr_note import HRNote
from app.models.sql.hr_celebration import HRCelebration
from app.models.sql.project import ProjectMember, Project, Task

router = APIRouter()


# ============================================
# HR OVERVIEW DASHBOARD
# ============================================

@router.get("/overview")
async def get_hr_overview(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """HR dashboard metrics."""
    today = date.today()

    # Total active people
    total_result = await db.execute(
        select(func.count(Person.id)).where(Person.deleted_at.is_(None))
    )
    total_people = total_result.scalar() or 0

    # Staff count
    staff_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.type == "staff",
            Person.status == "active",
        )
    )
    active_staff = staff_result.scalar() or 0

    # Volunteers
    vol_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.deleted_at.is_(None),
            Person.type == "volunteer",
            Person.status == "active",
        )
    )
    active_volunteers = vol_result.scalar() or 0

    # Birthdays this month
    birthday_result = await db.execute(
        select(Person)
        .where(
            Person.deleted_at.is_(None),
            Person.date_of_birth.isnot(None),
            func.extract("month", Person.date_of_birth) == today.month,
        )
        .order_by(func.extract("day", Person.date_of_birth))
    )
    birthday_people = birthday_result.scalars().all()

    birthdays = [
        {
            "id": str(p.id),
            "first_name": p.first_name,
            "last_name": p.last_name,
            "image_url": p.profile_image_url,
            "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
            "day": p.date_of_birth.day if p.date_of_birth else None,
        }
        for p in birthday_people
    ]

    # Anniversaries this month (from employment_relationships)
    from app.models.sql.user import Base as UserBase  # noqa

    return {
        "total_people": total_people,
        "active_staff": active_staff,
        "active_volunteers": active_volunteers,
        "birthdays_this_month": birthdays,
        "pending_documents": 0,  # placeholder
        "documents_expiring_soon": [],  # placeholder
        "pending_leave_requests": 0,  # placeholder for Session 2
    }


# ============================================
# HR EMPLOYEES LIST
# ============================================

@router.get("/employees")
async def list_employees(
    search: Optional[str] = None,
    type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    department_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """List all employees with HR view (includes sensitive fields)."""
    query = select(Person).where(Person.deleted_at.is_(None))

    if search:
        query = query.where(
            or_(
                Person.first_name.ilike(f"%{search}%"),
                Person.last_name.ilike(f"%{search}%"),
                Person.email.ilike(f"%{search}%"),
            )
        )
    if type:
        query = query.where(Person.type == type)
    if status_filter:
        query = query.where(Person.status == status_filter)

    query = query.order_by(Person.first_name).limit(limit)
    result = await db.execute(query)
    people = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "first_name": p.first_name,
            "last_name": p.last_name,
            "email": p.email,
            "phone": p.phone,
            "type": p.type,
            "status": getattr(p, "status", "active"),
            "job_title": getattr(p, "job_title", None),
            "location": getattr(p, "location", None),
            "employment_type": getattr(p, "employment_type", None),
            "profile_image_url": p.profile_image_url,
            "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        }
        for p in people
    ]


# ============================================
# HR EMPLOYEE DETAIL
# ============================================

@router.get("/employees/{person_id}")
async def get_employee_detail(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """Get full employee detail with HR-specific data."""
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Get documents
    docs_result = await db.execute(
        select(Document)
        .where(
            Document.related_entity_type == "person",
            Document.related_entity_id == person_id,
            Document.deleted_at.is_(None),
        )
        .order_by(Document.created_at.desc())
    )
    documents = docs_result.scalars().all()

    # Get HR notes
    notes_result = await db.execute(
        select(HRNote)
        .where(HRNote.person_id == person_id)
        .order_by(HRNote.created_at.desc())
    )
    notes = notes_result.scalars().all()

    # Get assigned projects
    projects_result = await db.execute(
        select(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .where(ProjectMember.person_id == person_id)
    )
    projects = projects_result.scalars().all()

    # Get open tasks
    tasks_result = await db.execute(
        select(Task)
        .where(
            Task.assignee_id == person_id,
            Task.status.notin_(["done", "cancelled"]),
        )
        .limit(20)
    )
    tasks = tasks_result.scalars().all()

    return {
        "person": {
            "id": str(person.id),
            "first_name": person.first_name,
            "last_name": person.last_name,
            "email": person.email,
            "phone": person.phone,
            "type": person.type,
            "status": getattr(person, "status", "active"),
            "job_title": getattr(person, "job_title", None),
            "location": getattr(person, "location", None),
            "employment_type": getattr(person, "employment_type", None),
            "date_of_birth": person.date_of_birth.isoformat() if person.date_of_birth else None,
            "gender": person.gender,
            "address": person.address,
            "city": person.city,
            "country": person.country,
            "emergency_contact_name": person.emergency_contact_name,
            "emergency_contact_phone": person.emergency_contact_phone,
            "emergency_contact_relationship": person.emergency_contact_relationship,
            "profile_image_url": person.profile_image_url,
            "created_at": person.created_at.isoformat() if person.created_at else None,
        },
        "documents": [
            {
                "id": str(d.id),
                "name": d.name,
                "file_url": d.file_url,
                "mime_type": d.mime_type,
                "verified": d.verified,
                "expiry_date": d.expiry_date.isoformat() if d.expiry_date else None,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "notes": [
            {
                "id": str(n.id),
                "category": n.category,
                "title": n.title,
                "content": n.content,
                "author_id": str(n.author_id) if n.author_id else None,
                "author_first_name": n.author.first_name if n.author else None,
                "author_last_name": n.author.last_name if n.author else None,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "projects": [
            {
                "id": str(p.id),
                "name": p.name,
                "code": p.code,
                "status": p.status,
            }
            for p in projects
        ],
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
            }
            for t in tasks
        ],
    }


# ============================================
# DOCUMENT TYPES
# ============================================

@router.get("/document-types")
async def list_document_types(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """List all HR document types."""
    result = await db.execute(select(DocumentType).order_by(DocumentType.name))
    types = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "name": t.name,
            "description": t.description,
            "is_required": t.is_required,
            "applies_to": t.applies_to,
            "validity_months": t.validity_months,
        }
        for t in types
    ]


# ============================================
# HR NOTES
# ============================================

@router.post("/employees/{person_id}/notes")
async def create_hr_note(
    person_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_EDIT_SENSITIVE)),
):
    """Add an HR note to an employee."""
    note = HRNote(
        id=str(uuid.uuid4()),
        person_id=person_id,
        author_id=current_user.person_id,
        category=payload.get("category", "general"),
        title=payload.get("title"),
        content=payload.get("content", ""),
        is_sensitive=payload.get("is_sensitive", True),
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {"id": str(note.id), "message": "Note created"}


# ============================================
# CELEBRATIONS (birthdays + anniversaries)
# ============================================

@router.get("/celebrations")
async def get_celebrations(
    days_ahead: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """Get upcoming birthdays and work anniversaries."""
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    # Birthdays in range — using month/day logic
    result = await db.execute(
        select(Person).where(
            Person.deleted_at.is_(None),
            Person.date_of_birth.isnot(None),
        )
    )
    people = result.scalars().all()

    celebrations = []

    for p in people:
        if not p.date_of_birth:
            continue
        # Use this year's birthday
        try:
            this_year_bday = p.date_of_birth.replace(year=today.year)
        except ValueError:
            # Feb 29 — use Feb 28
            this_year_bday = p.date_of_birth.replace(year=today.year, day=28)

        # If already passed, try next year
        if this_year_bday < today:
            try:
                this_year_bday = p.date_of_birth.replace(year=today.year + 1)
            except ValueError:
                this_year_bday = p.date_of_birth.replace(year=today.year + 1, day=28)

        if today <= this_year_bday <= end_date:
            days_away = (this_year_bday - today).days
            years = this_year_bday.year - p.date_of_birth.year
            celebrations.append({
                "id": f"bday-{p.id}",
                "type": "birthday",
                "person_id": str(p.id),
                "first_name": p.first_name,
                "last_name": p.last_name,
                "image_url": p.profile_image_url,
                "date": this_year_bday.isoformat(),
                "days_away": days_away,
                "years": years,
                "label": f"{p.first_name} {p.last_name} turns {years}",
            })

    celebrations.sort(key=lambda x: x["days_away"])
    return celebrations
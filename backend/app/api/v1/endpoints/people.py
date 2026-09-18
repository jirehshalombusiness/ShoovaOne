from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import Person
from app.models.pydantic.person import (
    PersonResponse,
    PersonCreate,
    PersonUpdate,
    OrgNode,
    OrgChartResponse,
)
from app.services.audit_service import AuditService

router = APIRouter()


# ============================================
# LIST + ORG CHART (specific routes first!)
# ============================================

@router.get("/", response_model=List[PersonResponse])
async def get_people(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """Get list of people. Requires: people.view permission."""

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

    if status:
        query = query.where(Person.status == status)

    query = (
        query
        .offset(skip)
        .limit(limit)
        .order_by(Person.created_at.desc())
    )

    result = await db.execute(query)
    people = result.scalars().all()

    return [
        PersonResponse(
            id=str(p.id),
            first_name=p.first_name,
            last_name=p.last_name,
            email=p.email,
            phone=p.phone,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            type=p.type,
            status=getattr(p, "status", "active"),
            job_title=getattr(p, "job_title", None),
            location=getattr(p, "location", None),
            employment_type=getattr(p, "employment_type", None),
            reports_to_id=(
                str(p.reports_to_id)
                if p.reports_to_id
                else None
            ),
            profile_image_url=p.profile_image_url,
            address=p.address,
            city=p.city,
            state=p.state,
            country=p.country,
            postal_code=p.postal_code,
            emergency_contact_name=p.emergency_contact_name,
            emergency_contact_phone=p.emergency_contact_phone,
            emergency_contact_relationship=p.emergency_contact_relationship,
            bio=p.bio,
            skills=p.skills,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in people
    ]


# ============================================
# ORG CHART
# ============================================

@router.get("/org-chart", response_model=OrgChartResponse)
async def get_org_chart(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """Get organisational chart: all active people with their reporting lines."""

    result = await db.execute(
        select(Person)
        .where(
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
        .order_by(Person.first_name)
    )

    people = result.scalars().all()

    # Count direct reports per manager
    direct_report_counts: dict[str, int] = {}

    for p in people:
        if p.reports_to_id:
            rid = str(p.reports_to_id)
            direct_report_counts[rid] = (
                direct_report_counts.get(rid, 0) + 1
            )

    nodes: List[OrgNode] = []
    roots: List[str] = []

    for p in people:
        pid = str(p.id)
        rid = (
            str(p.reports_to_id)
            if p.reports_to_id
            else None
        )

        nodes.append(
            OrgNode(
                id=pid,
                first_name=p.first_name,
                last_name=p.last_name,
                job_title=getattr(p, "job_title", None),
                location=getattr(p, "location", None),
                profile_image_url=p.profile_image_url,
                reports_to_id=rid,
                direct_reports_count=direct_report_counts.get(
                    pid,
                    0,
                ),
            )
        )

        if not rid:
            roots.append(pid)

    return OrgChartResponse(
        nodes=nodes,
        roots=roots,
    )


# ============================================
# CREATE PERSON
# ============================================

@router.post(
    "/",
    response_model=PersonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_person(
    person_data: PersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.PEOPLE_CREATE)
    ),
):
    """Create a new person and record a PERSON_CREATED audit event."""

    # --------------------------------------------
    # Check for duplicate email
    # --------------------------------------------
    if person_data.email:
        existing = await db.execute(
            select(Person).where(
                Person.email == person_data.email,
                Person.deleted_at.is_(None),
            )
        )

        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Email already exists",
            )

    # --------------------------------------------
    # Create person
    # --------------------------------------------
    import uuid

    person = Person(
        id=str(uuid.uuid4()),
        **person_data.model_dump(),
    )

    db.add(person)

    # Make sure the person is persisted in the
    # current transaction before creating the audit.
    await db.flush()

    # --------------------------------------------
    # Audit: PERSON_CREATED
    # --------------------------------------------
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PERSON_CREATED",
        entity_type="person",
        entity_id=person.id,
        description=(
            f"Created person record for "
            f"{person.first_name} {person.last_name}"
        ),
        new_values={
            "first_name": person.first_name,
            "last_name": person.last_name,
            "email": person.email,
            "phone": person.phone,
            "type": person.type,
            "status": getattr(
                person,
                "status",
                "active",
            ),
            "job_title": getattr(
                person,
                "job_title",
                None,
            ),
            "location": getattr(
                person,
                "location",
                None,
            ),
            "employment_type": getattr(
                person,
                "employment_type",
                None,
            ),
            "reports_to_id": (
                str(person.reports_to_id)
                if person.reports_to_id
                else None
            ),
        },
    )

    # Person + audit are committed together.
    await db.commit()
    await db.refresh(person)

    return person


# ============================================
# GET PERSON
# ============================================

@router.get(
    "/{person_id}",
    response_model=PersonResponse,
)
async def get_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.PEOPLE_VIEW)
    ),
):
    """Get person by ID."""

    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )

    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    return person


# ============================================
# UPDATE PERSON
# ============================================

@router.put(
    "/{person_id}",
    response_model=PersonResponse,
)
async def update_person(
    person_id: str,
    person_data: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.PEOPLE_EDIT)
    ),
):
    """Update a person and record a PERSON_UPDATED audit event."""

    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )

    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    # --------------------------------------------
    # Capture only fields being changed
    # --------------------------------------------
    changes = person_data.model_dump(
        exclude_unset=True
    )

    old_values = {}
    new_values = {}

    for key, value in changes.items():
        old_value = getattr(
            person,
            key,
            None,
        )

        # Convert values to strings where necessary
        # so they are safely JSON serializable.
        if old_value is not None:
            old_value = str(old_value)

        if value is not None:
            value_for_audit = str(value)
        else:
            value_for_audit = None

        old_values[key] = old_value
        new_values[key] = value_for_audit

        setattr(
            person,
            key,
            value,
        )

    # --------------------------------------------
    # Audit: PERSON_UPDATED
    # --------------------------------------------
    if changes:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="PERSON_UPDATED",
            entity_type="person",
            entity_id=person.id,
            description=(
                f"Updated person record for "
                f"{person.first_name} {person.last_name}"
            ),
            old_values=old_values,
            new_values=new_values,
        )

    # Person + audit committed together.
    await db.commit()
    await db.refresh(person)

    return person


# ============================================
# DELETE PERSON
# ============================================

@router.delete(
    "/{person_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.PEOPLE_DELETE)
    ),
):
    """
    Soft-delete a person and record a PERSON_DELETED
    audit event.

    The underlying person record is preserved in the
    database; only deleted_at is set.
    """

    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )

    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    # --------------------------------------------
    # Capture identifying information before delete
    # --------------------------------------------
    old_values = {
        "first_name": person.first_name,
        "last_name": person.last_name,
        "email": person.email,
        "phone": person.phone,
        "type": person.type,
        "status": getattr(
            person,
            "status",
            "active",
        ),
        "job_title": getattr(
            person,
            "job_title",
            None,
        ),
    }

    # --------------------------------------------
    # Soft delete
    # --------------------------------------------
    from sqlalchemy.sql import func

    person.deleted_at = func.now()

    # --------------------------------------------
    # Audit: PERSON_DELETED
    # --------------------------------------------
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PERSON_DELETED",
        entity_type="person",
        entity_id=person.id,
        description=(
            f"Deleted person record for "
            f"{person.first_name} {person.last_name}"
        ),
        old_values=old_values,
        new_values={
            "deleted": True,
        },
    )

    # Person soft-delete + audit committed together.
    await db.commit()

    return None
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from app.models.pydantic.person import OrgChartResponse, OrgNode

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import Person
from app.models.pydantic.person import PersonResponse, PersonCreate, PersonUpdate

router = APIRouter()


@router.get("/", response_model=List[PersonResponse])
async def get_people(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """Get list of people. Requires: people.view permission"""
    try:
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

        query = query.offset(skip).limit(limit).order_by(Person.created_at.desc())
        result = await db.execute(query)
        people = result.scalars().all()
        
        # Explicitly convert to response objects with string IDs
        return [
            PersonResponse(
                id=str(person.id),
                first_name=person.first_name,
                last_name=person.last_name,
                email=person.email,
                phone=person.phone,
                date_of_birth=person.date_of_birth,
                gender=person.gender,
                type=person.type,
                status=getattr(person, 'status', 'active'),
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
                created_at=person.created_at,
                updated_at=person.updated_at,
            )
            for person in people
        ]
    except Exception as e:
        print(f"❌ Error getting people: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # ============================================
# ORG CHART ENDPOINTS
# ========================================




@router.get("/org-chart", response_model=OrgChartResponse)
async def get_org_chart(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """
    Get organizational chart: all active people with their reporting lines.
    """
    # Get all active people
    result = await db.execute(
        select(Person)
        .where(
            Person.deleted_at.is_(None),
            Person.status == "active",
        )
        .order_by(Person.first_name)
    )
    people = result.scalars().all()

    # Build response nodes
    nodes: List[OrgNode] = []
    direct_report_counts: dict[str, int] = {}

    for person in people:
        # Count direct reports for this person
        if person.reports_to_id:
            direct_report_counts[person.reports_to_id] = (
                direct_report_counts.get(person.reports_to_id, 0) + 1
            )

    for person in people:
        nodes.append(
            OrgNode(
                id=str(person.id),
                first_name=person.first_name,
                last_name=person.last_name,
                job_title=getattr(person, "job_title", None),
                location=getattr(person, "location", None),
                profile_image_url=person.profile_image_url,
                reports_to_id=str(person.reports_to_id) if person.reports_to_id else None,
                direct_reports_count=direct_report_counts.get(str(person.id), 0),
            )
        )

    # Roots = people with no manager
    roots = [str(p.id) for p in people if not p.reports_to_id]

    return OrgChartResponse(nodes=nodes, roots=roots)


@router.put("/{person_id}/reports-to", response_model=PersonResponse)
async def update_reports_to(
    person_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_EDIT)),
):
    """
    Update who a person reports to.
    Body: { "reports_to_id": "uuid-or-null" }
    """
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    reports_to_id = payload.get("reports_to_id")

    # Prevent self-reporting
    if reports_to_id == person_id:
        raise HTTPException(status_code=400, detail="A person cannot report to themselves")

    # If setting a manager, verify they exist
    if reports_to_id:
        manager_result = await db.execute(
            select(Person).where(
                Person.id == reports_to_id,
                Person.deleted_at.is_(None),
            )
        )
        manager = manager_result.scalar_one_or_none()
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")

        # Prevent circular reporting
        # Walk up the chain to check if person_id appears
        current_id = reports_to_id
        visited = set()
        while current_id and current_id not in visited:
            visited.add(current_id)
            check = await db.execute(
                select(Person.reports_to_id).where(Person.id == current_id)
            )
            row = check.first()
            current_id = str(row[0]) if row and row[0] else None
            if current_id == person_id:
                raise HTTPException(
                    status_code=400,
                    detail="Circular reporting relationship detected",
                )

    person.reports_to_id = reports_to_id
    await db.commit()
    await db.refresh(person)
    return person
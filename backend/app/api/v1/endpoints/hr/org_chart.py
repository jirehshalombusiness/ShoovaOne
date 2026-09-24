from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class OrgChartNode(BaseModel):
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    profile_image_url: Optional[str] = None
    reports_to_id: Optional[str] = None
    direct_reports_count: int = 0


class OrgChartResponse(BaseModel):
    nodes: List[OrgChartNode]
    roots: List[str]


class UpdateReportsToRequest(BaseModel):
    reports_to_id: Optional[str] = Field(
        None,
        description="Person ID of the new manager. Null to make this person a root.",
    )


# ============================================================
# HELPERS
# ============================================================

def _person_name(p: Optional[Person]) -> Optional[str]:
    if not p:
        return None
    return f"{p.first_name} {p.last_name}".strip()


async def _would_create_cycle(
    db: AsyncSession,
    person_id: str,
    new_manager_id: str,
) -> bool:
    """
    Walk up the reporting chain from new_manager_id.
    If we ever hit person_id, this update would create a cycle.
    """
    if person_id == new_manager_id:
        return True

    visited = set()
    cursor = new_manager_id

    while cursor and cursor not in visited:
        if cursor == person_id:
            return True
        visited.add(cursor)

        result = await db.execute(
            select(Person.reports_to_id).where(Person.id == cursor)
        )
        cursor = result.scalar_one_or_none()

    return False


# ============================================================
# GET /hr/org-chart
# ============================================================

@router.get("/org-chart", response_model=OrgChartResponse)
async def get_org_chart(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Everyone can view the org chart.
    Only authentication is required — no permission gate.
    """
    result = await db.execute(
        select(Person)
        .where(
            Person.deleted_at.is_(None),
            Person.status == "active",
            Person.type.in_(["staff", "volunteer"]),
        )
        .order_by(Person.first_name)
    )
    people = list(result.scalars().all())

    # Count direct reports
    direct_report_counts: dict[str, int] = {}
    for p in people:
        if p.reports_to_id:
            rid = str(p.reports_to_id)
            direct_report_counts[rid] = direct_report_counts.get(rid, 0) + 1

    nodes: List[OrgChartNode] = []
    roots: List[str] = []

    for p in people:
        pid = str(p.id)
        rid = str(p.reports_to_id) if p.reports_to_id else None

        nodes.append(
            OrgChartNode(
                id=pid,
                first_name=p.first_name,
                last_name=p.last_name,
                job_title=p.job_title,
                department=p.department,
                location=p.location,
                profile_image_url=p.profile_image_url,
                reports_to_id=rid,
                direct_reports_count=direct_report_counts.get(pid, 0),
            )
        )

        if not rid:
            roots.append(pid)

    return OrgChartResponse(nodes=nodes, roots=roots)


# ============================================================
# PATCH /hr/org-chart/{person_id}/reports-to
# ============================================================

@router.patch(
    "/org-chart/{person_id}/reports-to",
    response_model=OrgChartNode,
)
async def update_reports_to(
    person_id: str,
    payload: UpdateReportsToRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_EMPLOYMENT)),
):
    """
    Update who a person reports to.

    Requires hr.edit_employment (HR only).

    Validations:
    - person must exist and not be deleted
    - new manager must exist and not be deleted
    - cannot report to self
    - cannot create a reporting cycle
    """
    # Load person
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    new_manager_id = payload.reports_to_id

    # Validate manager
    if new_manager_id:
        if new_manager_id == person_id:
            raise HTTPException(
                status_code=400,
                detail="A person cannot report to themselves",
            )

        mgr_result = await db.execute(
            select(Person).where(
                Person.id == new_manager_id,
                Person.deleted_at.is_(None),
            )
        )
        manager = mgr_result.scalar_one_or_none()
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")

        if await _would_create_cycle(db, person_id, new_manager_id):
            raise HTTPException(
                status_code=400,
                detail="This change would create a reporting cycle",
            )

    old_manager_id = person.reports_to_id
    person.reports_to_id = new_manager_id

    await AuditService.log(
        db=db,
        actor=current_user,
        action="REPORTS_TO_CHANGED",
        entity_type="person",
        entity_id=person.id,
        description=(
            f"Changed manager for {person.first_name} {person.last_name}"
        ),
        old_values={"reports_to_id": old_manager_id},
        new_values={"reports_to_id": new_manager_id},
    )

    await db.commit()
    await db.refresh(person)

    # Re-count direct reports for the response
    count_result = await db.execute(
        select(func.count(Person.id)).where(
            Person.reports_to_id == person.id,
            Person.deleted_at.is_(None),
        )
    )
    dr_count = count_result.scalar() or 0

    return OrgChartNode(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        job_title=person.job_title,
        department=person.department,
        location=person.location,
        profile_image_url=person.profile_image_url,
        reports_to_id=person.reports_to_id,
        direct_reports_count=dr_count,
    )
from datetime import date
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User, Person
from app.models.sql.compensation import CompensationChange
from app.services import approval_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class CompensationPerson(BaseModel):
    id: str
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None


class CompensationItem(BaseModel):
    id: str
    person_id: str
    person: CompensationPerson
    base_amount: float
    currency: str
    frequency: str
    effective_from: str
    effective_to: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[str] = None
    created_at: str
    is_current: bool = False


class CompensationListResponse(BaseModel):
    items: List[CompensationItem]
    total: int


class CompensationCreate(BaseModel):
    person_id: str
    base_amount: float = Field(..., ge=0)
    currency: str = Field("GHS", max_length=3)
    frequency: str = Field("monthly", max_length=20)
    effective_from: date
    reason: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class CompensationUpdate(BaseModel):
    base_amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    frequency: Optional[str] = Field(None, max_length=20)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    reason: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


async def _person_bundle(db, ids):
    if not ids:
        return {}
    result = await db.execute(select(Person).where(Person.id.in_(ids)))
    return {p.id: p for p in result.scalars().all()}


def _serialize(
    c: CompensationChange,
    person: Optional[Person],
    approver_name: Optional[str],
    is_current: bool,
) -> CompensationItem:
    return CompensationItem(
        id=c.id,
        person_id=c.person_id,
        person=CompensationPerson(
            id=person.id if person else "",
            first_name=person.first_name if person else "",
            last_name=person.last_name if person else "",
            profile_image_url=person.profile_image_url if person else None,
            job_title=person.job_title if person else None,
            department=person.department if person else None,
        ),
        base_amount=float(c.base_amount),
        currency=c.currency,
        frequency=c.frequency,
        effective_from=c.effective_from.isoformat(),
        effective_to=_iso(c.effective_to),
        reason=c.reason,
        notes=c.notes,
        approved_by_id=c.approved_by_id,
        approved_by_name=approver_name,
        approved_at=_iso(c.approved_at),
        created_at=c.created_at.isoformat() if c.created_at else "",
        is_current=is_current,
    )


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=CompensationListResponse)
async def list_compensation(
    person_id: Optional[str] = None,
    current_only: bool = Query(False),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_COMPENSATION)),
):
    """
    Compensation records. Requires hr.view_compensation.
    """
    filters = []
    if person_id:
        filters.append(CompensationChange.person_id == person_id)
    if current_only:
        filters.append(CompensationChange.effective_to.is_(None))

    count_query = select(func.count(CompensationChange.id))
    if filters:
        count_query = count_query.where(*filters)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = select(CompensationChange)
    if filters:
        query = query.where(*filters)
    query = (
        query
        .order_by(CompensationChange.effective_from.desc())
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    changes = list(result.scalars().all())

    persons = await _person_bundle(db, list({c.person_id for c in changes}))

    approver_ids = [c.approved_by_id for c in changes if c.approved_by_id]
    approvers: dict[str, str] = {}
    if approver_ids:
        a_result = await db.execute(
            select(Person.id, Person.first_name, Person.last_name)
            .where(Person.id.in_(approver_ids))
        )
        approvers = {row[0]: f"{row[1]} {row[2]}".strip() for row in a_result.all()}

    return CompensationListResponse(
        items=[
            _serialize(
                c,
                persons.get(c.person_id),
                approvers.get(c.approved_by_id) if c.approved_by_id else None,
                c.effective_to is None,
            )
            for c in changes
        ],
        total=total,
    )


# ============================================================
# GET — for a specific person
# ============================================================

@router.get("/person/{person_id}", response_model=List[CompensationItem])
async def get_person_compensation(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_COMPENSATION)),
):
    person_result = await db.execute(select(Person).where(Person.id == person_id))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    result = await db.execute(
        select(CompensationChange)
        .options(selectinload(CompensationChange.approver))
        .where(CompensationChange.person_id == person_id)
        .order_by(CompensationChange.effective_from.desc())
    )
    changes = list(result.scalars().all())

    return [
        _serialize(
            c,
            person,
            (
                f"{c.approver.first_name} {c.approver.last_name}".strip()
                if c.approver
                else None
            ),
            c.effective_to is None,
        )
        for c in changes
    ]


# ============================================================
# CREATE — triggers approval request
# ============================================================

class CompensationCreateResponse(BaseModel):
    id: str
    status: str
    message: str
    approval_id: Optional[str] = None


@router.post(
    "",
    response_model=CompensationCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_compensation_change(
    payload: CompensationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_COMPENSATION)),
):
    """
    Request a compensation change.

    Per company policy, all compensation changes require director sign-off.
    The record is created in pending state (effective_to=None but
    approved_at=None) and an ApprovalRequest is routed to the executive
    team. When the approval is decided, the record is finalized.
    """
    person_result = await db.execute(
        select(Person).where(
            Person.id == payload.person_id,
            Person.deleted_at.is_(None),
        )
    )
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Close any current comp record only after approval.
    # So we do NOT modify existing rows here.

    change = CompensationChange(
        id=str(uuid.uuid4()),
        person_id=payload.person_id,
        base_amount=Decimal(str(payload.base_amount)),
        currency=payload.currency,
        frequency=payload.frequency,
        effective_from=payload.effective_from,
        effective_to=None,
        reason=payload.reason,
        notes=payload.notes,
    )
    db.add(change)
    await db.flush()

    approval = await approval_service.create_request(
        db=db,
        entity_type="compensation_change",
        entity_id=change.id,
        requested_by_id=current_user.person_id,
        title=(
            f"Compensation change: {person.first_name} {person.last_name} "
            f"-> {payload.currency} {payload.base_amount:,.2f}/{payload.frequency}"
        ),
        summary=(
            f"Effective from {payload.effective_from.isoformat()}"
            + (f" — {payload.reason}" if payload.reason else "")
        ),
        priority="high",
        due_hours=168,
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="COMPENSATION_CHANGE_REQUESTED",
        entity_type="compensation_change",
        entity_id=change.id,
        description=f"Requested compensation change for {person.first_name} {person.last_name}",
        new_values={
            "base_amount": str(payload.base_amount),
            "currency": payload.currency,
            "frequency": payload.frequency,
            "effective_from": payload.effective_from.isoformat(),
        },
    )

    await db.commit()

    return CompensationCreateResponse(
        id=change.id,
        status="pending_approval",
        message=(
            "Compensation change created. An approval request has been "
            "routed to the executive team."
        ),
        approval_id=approval.id,
    )


# ============================================================
# UPDATE
# ============================================================

@router.patch("/{change_id}", response_model=CompensationItem)
async def update_compensation_change(
    change_id: str,
    payload: CompensationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_COMPENSATION)),
):
    result = await db.execute(
        select(CompensationChange).where(CompensationChange.id == change_id)
    )
    change = result.scalar_one_or_none()
    if not change:
        raise HTTPException(status_code=404, detail="Compensation change not found")

    if change.approved_at is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot edit an approved compensation change. "
                "Create a new change to supersede it."
            ),
        )

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No changes supplied")

    old_values = {}
    for key, value in changes.items():
        old = getattr(change, key, None)
        old_values[key] = str(old) if old is not None else None

        if key == "base_amount" and value is not None:
            value = Decimal(str(value))

        setattr(change, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="COMPENSATION_CHANGE_UPDATED",
        entity_type="compensation_change",
        entity_id=change.id,
        description="Updated compensation change (pre-approval)",
        old_values=old_values,
        new_values={k: str(v) if v is not None else None for k, v in changes.items()},
    )

    await db.commit()
    await db.refresh(change)

    persons = await _person_bundle(db, [change.person_id])
    approvers = await _person_bundle(
        db, [change.approved_by_id] if change.approved_by_id else []
    )
    approver = approvers.get(change.approved_by_id) if change.approved_by_id else None

    return _serialize(
        change,
        persons.get(change.person_id),
        f"{approver.first_name} {approver.last_name}".strip() if approver else None,
        change.effective_to is None,
    )


# ============================================================
# FINALIZE (called internally by approval_service on approve)
# ============================================================

async def finalize_compensation_change(
    db: AsyncSession,
    *,
    change_id: str,
    approver_person_id: str,
) -> CompensationChange:
    """
    Apply an approved compensation change:
    - close any existing current row for the same person
    - mark this row approved

    Called from the approvals inbox when an entity_type='compensation_change'
    approval is approved.
    """
    result = await db.execute(
        select(CompensationChange).where(CompensationChange.id == change_id)
    )
    change = result.scalar_one_or_none()
    if not change:
        raise HTTPException(status_code=404, detail="Compensation change not found")

    # Close previous current rows
    prev_result = await db.execute(
        select(CompensationChange).where(
            CompensationChange.person_id == change.person_id,
            CompensationChange.id != change.id,
            CompensationChange.effective_to.is_(None),
        )
    )
    for prev in prev_result.scalars().all():
        prev.effective_to = change.effective_from

    from datetime import datetime, timezone
    change.approved_by_id = approver_person_id
    change.approved_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        action="COMPENSATION_CHANGE_APPLIED",
        entity_type="compensation_change",
        entity_id=change.id,
        description="Compensation change finalized after approval",
        new_values={
            "approved_by_id": approver_person_id,
            "approved_at": change.approved_at.isoformat(),
        },
    )

    return change
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.approval import ApprovalRequest
from app.models.sql.compensation import CompensationChange
from app.models.sql.compensation_request import CompensationRequest
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.user import Person, User
from app.services import approval_service
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class MyCurrentCompensation(BaseModel):
    is_set: bool
    base_amount: Optional[float] = None
    currency: str = "GHS"
    frequency: str = "monthly"
    effective_from: Optional[str] = None


class MyCompensationRequest(BaseModel):
    id: str
    requested_amount: Optional[float] = None
    currency: str
    frequency: str
    reason: str
    status: str
    created_at: str
    decided_at: Optional[str] = None
    decision_note: Optional[str] = None
    approval_id: Optional[str] = None


class CreateCompensationRequest(BaseModel):
    requested_amount: Optional[float] = Field(None, ge=0)
    currency: str = Field("GHS", max_length=3)
    frequency: str = Field("monthly", max_length=20)
    reason: str = Field(..., min_length=10, max_length=5000)


class CreateCompensationRequestResponse(BaseModel):
    id: str
    status: str
    approval_id: Optional[str] = None


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


async def _require_person(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Person:
    """Resolve the authenticated user's Person row."""
    if not current_user.person_id:
        raise HTTPException(
            status_code=400,
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
        raise HTTPException(status_code=404, detail="Employee record not found")
    return person


# ============================================================
# GET /me/compensation/current
# ============================================================

@router.get("/compensation/current", response_model=MyCurrentCompensation)
async def get_my_current_compensation(
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    My current compensation.

    Resolution order:
    1. Latest active CompensationChange (effective_to is null)
    2. Fall back to the current EmploymentContract
    3. Otherwise return is_set=false
    """
    # 1. Try CompensationChange (source of truth if present)
    change_result = await db.execute(
        select(CompensationChange)
        .where(
            CompensationChange.person_id == person.id,
            CompensationChange.effective_to.is_(None),
        )
        .order_by(desc(CompensationChange.effective_from))
        .limit(1)
    )
    change = change_result.scalar_one_or_none()

    if change:
        return MyCurrentCompensation(
            is_set=True,
            base_amount=float(change.base_amount),
            currency=change.currency,
            frequency=change.frequency,
            effective_from=change.effective_from.isoformat(),
        )

    # 2. Fall back to current contract
    contract_result = await db.execute(
        select(EmploymentContract)
        .where(
            EmploymentContract.person_id == person.id,
            EmploymentContract.is_current.is_(True),
        )
        .limit(1)
    )
    contract = contract_result.scalar_one_or_none()

    if contract and contract.compensation_amount:
        return MyCurrentCompensation(
            is_set=True,
            base_amount=float(contract.compensation_amount),
            currency=contract.compensation_currency or "GHS",
            frequency=contract.compensation_frequency or "monthly",
            effective_from=contract.start_date.isoformat(),
        )

    # 3. Nothing on file
    return MyCurrentCompensation(is_set=False)


# ============================================================
# GET /me/compensation/requests
# ============================================================

@router.get(
    "/compensation/requests",
    response_model=List[MyCompensationRequest],
)
async def list_my_compensation_requests(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
):
    """
    My compensation request history.
    """
    result = await db.execute(
        select(CompensationRequest)
        .where(CompensationRequest.person_id == person.id)
        .order_by(desc(CompensationRequest.created_at))
        .offset(offset)
        .limit(limit)
    )
    rows = list(result.scalars().all())

    return [
        MyCompensationRequest(
            id=r.id,
            requested_amount=(
                float(r.requested_amount)
                if r.requested_amount is not None
                else None
            ),
            currency=r.currency,
            frequency=r.frequency,
            reason=r.reason,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else "",
            decided_at=_iso(r.ceo_decided_at or r.hr_decided_at),
            decision_note=r.ceo_decision_note or r.hr_decision_note,
            approval_id=r.approval_id,
        )
        for r in rows
    ]


# ============================================================
# POST /me/compensation/requests
# ============================================================

@router.post(
    "/compensation/requests",
    response_model=CreateCompensationRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_compensation_request(
    payload: CreateCompensationRequest,
    db: AsyncSession = Depends(get_db),
    person: Person = Depends(_require_person),
    current_user: User = Depends(get_current_active_user),
):
    """
    Submit a compensation adjustment request.

    Creates:
    - CompensationRequest (status=pending_hr)
    - ApprovalRequest (entity_type=compensation_request)

    Routing:
    - Assigned to head_of_hr first
    - On HR approval, escalated to CEO (see approvals.py handler)

    Validations:
    - Cannot have more than 1 pending request at a time
    """
    # Reject if a pending request already exists
    existing_result = await db.execute(
        select(CompensationRequest).where(
            CompensationRequest.person_id == person.id,
            CompensationRequest.status.in_(["pending_hr", "pending_ceo"]),
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=(
                "You already have a compensation request in progress. "
                "Wait for it to be decided before submitting another."
            ),
        )

    # Create the request row
    request_row = CompensationRequest(
        id=str(uuid.uuid4()),
        person_id=person.id,
        requested_amount=(
            Decimal(str(payload.requested_amount))
            if payload.requested_amount is not None
            else None
        ),
        currency=payload.currency.upper(),
        frequency=payload.frequency,
        reason=payload.reason.strip(),
        status="pending_hr",
    )
    db.add(request_row)
    await db.flush()

    # Create the approval inbox row, routed to head_of_hr
    hr_approver = await approval_service._find_hr_approver(db)
    if not hr_approver:
        raise HTTPException(
            status_code=500,
            detail="No HR approver is configured. Contact system administrator.",
        )

    amount_text = (
        f"{payload.currency.upper()} {payload.requested_amount:,.2f}/{payload.frequency}"
        if payload.requested_amount is not None
        else "adjustment discussion"
    )

    approval = await approval_service.create_request(
        db=db,
        entity_type="compensation_request",
        entity_id=request_row.id,
        requested_by_id=person.id,
        title=f"Compensation request: {amount_text}",
        summary=payload.reason[:500],
        priority="normal",
        assigned_to_id=hr_approver,
        due_hours=168,  # 1 week
    )

    request_row.approval_id = approval.id

    await AuditService.log(
        db=db,
        actor=current_user,
        action="COMPENSATION_REQUEST_SUBMITTED",
        entity_type="compensation_request",
        entity_id=request_row.id,
        description=(
            f"Submitted compensation request: {amount_text}"
        ),
        new_values={
            "requested_amount": (
                str(payload.requested_amount)
                if payload.requested_amount is not None
                else None
            ),
            "currency": payload.currency.upper(),
            "frequency": payload.frequency,
            "assigned_to": hr_approver,
        },
    )

    await db.commit()

    return CreateCompensationRequestResponse(
        id=request_row.id,
        status="pending_hr",
        approval_id=approval.id,
    )
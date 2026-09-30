from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.allocation import Allocation
from app.models.sql.budget import Budget
from app.models.sql.user import User
from app.schemas.allocation import (
    AllocationApproval,
    AllocationClosure,
    AllocationCreate,
    AllocationResponse,
    AllocationSubmission,
    AllocationUpdate,
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter()


def generate_allocation_number() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    return f"ALC-{timestamp[-12:]}"


def to_response(allocation: Allocation) -> AllocationResponse:
    return AllocationResponse(
        id=str(allocation.id),
        allocation_number=allocation.allocation_number,
        budget_id=str(allocation.budget_id),
        name=allocation.name,
        description=allocation.description,
        amount=allocation.amount,
        currency=allocation.currency,
        status=allocation.status,
        organisation_id=(
            str(allocation.organisation_id)
            if allocation.organisation_id
            else None
        ),
        department_id=(
            str(allocation.department_id)
            if allocation.department_id
            else None
        ),
        programme_id=(
            str(allocation.programme_id)
            if allocation.programme_id
            else None
        ),
        project_id=(
            str(allocation.project_id)
            if allocation.project_id
            else None
        ),
        notes=allocation.notes,
        submitted_at=allocation.submitted_at,
        approved_at=allocation.approved_at,
        activated_at=allocation.activated_at,
        closed_at=allocation.closed_at,
        submitted_by_id=(
            str(allocation.submitted_by_id)
            if allocation.submitted_by_id
            else None
        ),
        approved_by_id=(
            str(allocation.approved_by_id)
            if allocation.approved_by_id
            else None
        ),
        activated_by_id=(
            str(allocation.activated_by_id)
            if allocation.activated_by_id
            else None
        ),
        closed_by_id=(
            str(allocation.closed_by_id)
            if allocation.closed_by_id
            else None
        ),
        created_by_id=(
            str(allocation.created_by_id)
            if allocation.created_by_id
            else None
        ),
        created_at=allocation.created_at,
        updated_at=allocation.updated_at,
    )


async def get_allocation_or_404(
    db: AsyncSession,
    allocation_id: UUID,
) -> Allocation:
    result = await db.execute(
        select(Allocation).where(Allocation.id == allocation_id)
    )
    allocation = result.scalar_one_or_none()

    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation not found.",
        )

    return allocation


async def get_budget_or_404(
    db: AsyncSession,
    budget_id: UUID,
) -> Budget:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id)
    )
    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found.",
        )

    return budget


async def ensure_allocation_access(
    db: AsyncSession,
    allocation: Allocation,
    current_user: User,
) -> None:
    if await FinanceAccessService.can_view_all(db, current_user):
        return

    if allocation.created_by_id == current_user.person_id:
        return

    if allocation.project_id:
        project_manager_result = await db.execute(
            select(Budget.project_id).where(
                Budget.project_id == allocation.project_id,
                Budget.id == allocation.budget_id,
            )
        )

        if project_manager_result.scalar_one_or_none():
            budget_result = await db.execute(
                select(Budget).where(Budget.id == allocation.budget_id)
            )
            budget = budget_result.scalar_one_or_none()

            if budget and budget.created_by_id == current_user.person_id:
                return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this allocation.",
    )


async def get_total_allocated(
    db: AsyncSession,
    budget_id: UUID,
    exclude_allocation_id: Optional[UUID] = None,
) -> Decimal:
    query = select(
        func.coalesce(
            func.sum(Allocation.amount),
            0,
        )
    ).where(
        Allocation.budget_id == budget_id,
        Allocation.status != "closed",
    )

    if exclude_allocation_id:
        query = query.where(
            Allocation.id != exclude_allocation_id
        )

    result = await db.execute(query)

    return Decimal(str(result.scalar() or 0))


async def ensure_budget_can_be_allocated(
    budget: Budget,
) -> None:
    if budget.status not in {"approved", "active"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Allocations can only be created or changed "
                "for approved or active budgets."
            ),
        )


async def validate_allocation_amount(
    db: AsyncSession,
    budget: Budget,
    amount: Decimal,
    exclude_allocation_id: Optional[UUID] = None,
) -> None:
    if amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation amount must be greater than zero.",
        )

    if amount > budget.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Allocation amount cannot exceed the budget amount.",
        )

    total_allocated = await get_total_allocated(
        db,
        budget.id,
        exclude_allocation_id=exclude_allocation_id,
    )

    remaining = Decimal(str(budget.amount)) - total_allocated

    if amount > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Allocation exceeds the remaining budget. "
                f"Remaining amount: {remaining} {budget.currency}."
            ),
        )


@router.post(
    "/allocations",
    response_model=AllocationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_allocation(
    payload: AllocationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.create")),
):
    budget = await get_budget_or_404(
        db,
        UUID(payload.budget_id),
    )

    await ensure_budget_can_be_allocated(budget)

    if payload.currency.upper() != budget.currency.upper():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Allocation currency must match the budget currency "
                f"({budget.currency})."
            ),
        )

    await validate_allocation_amount(
        db,
        budget,
        payload.amount,
    )

    allocation = Allocation(
        allocation_number=generate_allocation_number(),
        budget_id=budget.id,
        name=payload.name,
        description=payload.description,
        amount=payload.amount,
        currency=payload.currency.upper(),
        status="draft",
        organisation_id=(
            UUID(payload.organisation_id)
            if payload.organisation_id
            else None
        ),
        department_id=(
            UUID(payload.department_id)
            if payload.department_id
            else None
        ),
        programme_id=(
            UUID(payload.programme_id)
            if payload.programme_id
            else None
        ),
        project_id=(
            UUID(payload.project_id)
            if payload.project_id
            else None
        ),
        notes=payload.notes,
        created_by_id=current_user.person_id,
    )

    db.add(allocation)
    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_CREATED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Created allocation {allocation.allocation_number}.",
        new_values={
            "allocation_number": allocation.allocation_number,
            "budget_id": str(allocation.budget_id),
            "name": allocation.name,
            "amount": str(allocation.amount),
            "currency": allocation.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)


@router.get(
    "/allocations",
    response_model=list[AllocationResponse],
)
async def list_allocations(
    budget_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    department_id: Optional[str] = Query(default=None),
    programme_id: Optional[str] = Query(default=None),
    project_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view")),
):
    query = select(Allocation)

    if budget_id:
        query = query.where(
            Allocation.budget_id == UUID(budget_id)
        )

    if status_filter:
        query = query.where(
            Allocation.status == status_filter
        )

    if department_id:
        query = query.where(
            Allocation.department_id == UUID(department_id)
        )

    if programme_id:
        query = query.where(
            Allocation.programme_id == UUID(programme_id)
        )

    if project_id:
        query = query.where(
            Allocation.project_id == UUID(project_id)
        )

    if search:
        search_value = f"%{search.strip()}%"
        query = query.where(
            or_(
                Allocation.allocation_number.ilike(search_value),
                Allocation.name.ilike(search_value),
                Allocation.description.ilike(search_value),
            )
        )

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        query = query.where(
            Allocation.created_by_id == current_user.person_id
        )

    query = query.order_by(
        Allocation.created_at.desc()
    )

    query = query.offset(
        (page - 1) * page_size
    ).limit(page_size)

    result = await db.execute(query)

    allocations = result.scalars().all()

    return [
        to_response(allocation)
        for allocation in allocations
    ]


@router.get(
    "/allocations/{allocation_id}",
    response_model=AllocationResponse,
)
async def get_allocation(
    allocation_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    return to_response(allocation)


@router.patch(
    "/allocations/{allocation_id}",
    response_model=AllocationResponse,
)
async def update_allocation(
    allocation_id: UUID,
    payload: AllocationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.edit")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    if allocation.status not in {"draft", "submitted"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only draft or submitted allocations "
                "can be edited."
            ),
        )

    budget = await get_budget_or_404(
        db,
        allocation.budget_id,
    )

    await ensure_budget_can_be_allocated(budget)

    old_values = {
        "name": allocation.name,
        "description": allocation.description,
        "amount": str(allocation.amount),
        "currency": allocation.currency,
        "organisation_id": (
            str(allocation.organisation_id)
            if allocation.organisation_id
            else None
        ),
        "department_id": (
            str(allocation.department_id)
            if allocation.department_id
            else None
        ),
        "programme_id": (
            str(allocation.programme_id)
            if allocation.programme_id
            else None
        ),
        "project_id": (
            str(allocation.project_id)
            if allocation.project_id
            else None
        ),
        "notes": allocation.notes,
    }

    if payload.amount is not None:
        await validate_allocation_amount(
            db,
            budget,
            payload.amount,
            exclude_allocation_id=allocation.id,
        )
        allocation.amount = payload.amount

    if payload.currency is not None:
        if payload.currency.upper() != budget.currency.upper():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Allocation currency must match the budget "
                    f"currency ({budget.currency})."
                ),
            )
        allocation.currency = payload.currency.upper()

    if payload.name is not None:
        allocation.name = payload.name

    if payload.description is not None:
        allocation.description = payload.description

    if payload.organisation_id is not None:
        allocation.organisation_id = UUID(
            payload.organisation_id
        )

    if payload.department_id is not None:
        allocation.department_id = UUID(
            payload.department_id
        )

    if payload.programme_id is not None:
        allocation.programme_id = UUID(
            payload.programme_id
        )

    if payload.project_id is not None:
        allocation.project_id = UUID(
            payload.project_id
        )

    if payload.notes is not None:
        allocation.notes = payload.notes

    new_values = {
        "name": allocation.name,
        "description": allocation.description,
        "amount": str(allocation.amount),
        "currency": allocation.currency,
        "organisation_id": (
            str(allocation.organisation_id)
            if allocation.organisation_id
            else None
        ),
        "department_id": (
            str(allocation.department_id)
            if allocation.department_id
            else None
        ),
        "programme_id": (
            str(allocation.programme_id)
            if allocation.programme_id
            else None
        ),
        "project_id": (
            str(allocation.project_id)
            if allocation.project_id
            else None
        ),
        "notes": allocation.notes,
    }

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_UPDATED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Updated allocation {allocation.allocation_number}.",
        old_values=old_values,
        new_values=new_values,
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)


@router.post(
    "/allocations/{allocation_id}/submit",
    response_model=AllocationResponse,
)
async def submit_allocation(
    allocation_id: UUID,
    payload: AllocationSubmission,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.edit")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    if allocation.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft allocations can be submitted.",
        )

    budget = await get_budget_or_404(
        db,
        allocation.budget_id,
    )

    await ensure_budget_can_be_allocated(budget)

    allocation.status = "submitted"
    allocation.submitted_at = datetime.utcnow()
    allocation.submitted_by_id = current_user.person_id

    if payload.notes:
        allocation.notes = payload.notes

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_SUBMITTED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Submitted allocation {allocation.allocation_number}.",
        new_values={
            "status": "submitted",
            "submitted_by_id": str(current_user.person_id),
            "notes": allocation.notes,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)


@router.post(
    "/allocations/{allocation_id}/approve",
    response_model=AllocationResponse,
)
async def approve_allocation(
    allocation_id: UUID,
    payload: AllocationApproval,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.approve")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    if allocation.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only submitted allocations "
                "can be approved."
            ),
        )

    budget = await get_budget_or_404(
        db,
        allocation.budget_id,
    )

    await ensure_budget_can_be_allocated(budget)

    await validate_allocation_amount(
        db,
        budget,
        allocation.amount,
        exclude_allocation_id=allocation.id,
    )

    allocation.status = "approved"
    allocation.approved_at = datetime.utcnow()
    allocation.approved_by_id = current_user.person_id

    if payload.notes:
        allocation.notes = payload.notes

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_APPROVED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Approved allocation {allocation.allocation_number}.",
        new_values={
            "status": "approved",
            "approved_by_id": str(current_user.person_id),
            "notes": allocation.notes,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)


@router.post(
    "/allocations/{allocation_id}/activate",
    response_model=AllocationResponse,
)
async def activate_allocation(
    allocation_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.edit")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    if allocation.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only approved allocations "
                "can be activated."
            ),
        )

    budget = await get_budget_or_404(
        db,
        allocation.budget_id,
    )

    if budget.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The budget must be active before "
                "an allocation can be activated."
            ),
        )

    allocation.status = "active"
    allocation.activated_at = datetime.utcnow()
    allocation.activated_by_id = current_user.person_id

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_ACTIVATED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Activated allocation {allocation.allocation_number}.",
        new_values={
            "status": "active",
            "activated_by_id": str(current_user.person_id),
        },
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)


@router.post(
    "/allocations/{allocation_id}/close",
    response_model=AllocationResponse,
)
async def close_allocation(
    allocation_id: UUID,
    payload: AllocationClosure,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.edit")),
):
    allocation = await get_allocation_or_404(
        db,
        allocation_id,
    )

    await ensure_allocation_access(
        db,
        allocation,
        current_user,
    )

    if allocation.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only active allocations "
                "can be closed."
            ),
        )

    allocation.status = "closed"
    allocation.closed_at = datetime.utcnow()
    allocation.closed_by_id = current_user.person_id

    existing_notes = allocation.notes or ""

    closure_note = (
        f"Closure reason: {payload.reason}"
    )

    allocation.notes = (
        f"{existing_notes}\n{closure_note}".strip()
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ALLOCATION_CLOSED",
        entity_type="allocation",
        entity_id=allocation.id,
        description=f"Closed allocation {allocation.allocation_number}.",
        new_values={
            "status": "closed",
            "closed_by_id": str(current_user.person_id),
            "closure_reason": payload.reason,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(allocation)

    return to_response(allocation)
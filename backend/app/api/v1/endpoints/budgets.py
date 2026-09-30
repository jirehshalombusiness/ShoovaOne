from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.budget import Budget
from app.models.sql.user import User
from app.schemas.budget import (
    BudgetApproval,
    BudgetClosure,
    BudgetCreate,
    BudgetResponse,
    BudgetSubmission,
    BudgetUpdate,
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter()


def generate_budget_number() -> str:
    year = datetime.now(timezone.utc).strftime("%Y")
    random_part = uuid4().hex[:6].upper()
    return f"BUD-{year}-{random_part}"


def to_response(budget: Budget) -> BudgetResponse:
    return BudgetResponse(
        id=str(budget.id),
        budget_number=budget.budget_number,
        name=budget.name,
        description=budget.description,
        fiscal_year=budget.fiscal_year,
        start_date=budget.start_date,
        end_date=budget.end_date,
        amount=budget.amount,
        currency=budget.currency,
        status=budget.status,
        organisation_id=(
            str(budget.organisation_id)
            if budget.organisation_id
            else None
        ),
        department_id=(
            str(budget.department_id)
            if budget.department_id
            else None
        ),
        programme_id=(
            str(budget.programme_id)
            if budget.programme_id
            else None
        ),
        project_id=(
            str(budget.project_id)
            if budget.project_id
            else None
        ),
        notes=budget.notes,
        submitted_at=budget.submitted_at,
        approved_at=budget.approved_at,
        activated_at=budget.activated_at,
        closed_at=budget.closed_at,
        submitted_by_id=(
            str(budget.submitted_by_id)
            if budget.submitted_by_id
            else None
        ),
        approved_by_id=(
            str(budget.approved_by_id)
            if budget.approved_by_id
            else None
        ),
        activated_by_id=(
            str(budget.activated_by_id)
            if budget.activated_by_id
            else None
        ),
        closed_by_id=(
            str(budget.closed_by_id)
            if budget.closed_by_id
            else None
        ),
        created_by_id=(
            str(budget.created_by_id)
            if budget.created_by_id
            else None
        ),
        created_at=budget.created_at,
        updated_at=budget.updated_at,
    )


async def get_budget_or_404(
    db: AsyncSession,
    budget_id: str,
) -> Budget:
    result = await db.execute(
        select(Budget).where(Budget.id == budget_id)
    )

    budget = result.scalar_one_or_none()

    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found",
        )

    return budget


async def ensure_budget_access(
    db: AsyncSession,
    budget: Budget,
    current_user: User,
) -> None:
    if await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        return

    if (
        budget.created_by_id
        and current_user.person_id
        and budget.created_by_id == current_user.person_id
    ):
        return

    if (
        budget.project_id
        and current_user.person_id
    ):
        from app.models.sql.project import Project

        project_result = await db.execute(
            select(Project).where(
                Project.id == budget.project_id
            )
        )

        project = project_result.scalar_one_or_none()

        if (
            project
            and project.manager_id
            and project.manager_id == current_user.person_id
        ):
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this budget",
    )


def validate_dates(
    start_date,
    end_date,
) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget end date cannot be before start date",
        )


@router.post(
    "/budgets",
    response_model=BudgetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_budget(
    payload: BudgetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    validate_dates(
        payload.start_date,
        payload.end_date,
    )

    budget = Budget(
        budget_number=generate_budget_number(),
        name=payload.name,
        description=payload.description,
        fiscal_year=payload.fiscal_year,
        start_date=payload.start_date,
        end_date=payload.end_date,
        amount=payload.amount,
        currency=payload.currency.upper(),
        status="draft",
        organisation_id=payload.organisation_id,
        department_id=payload.department_id,
        programme_id=payload.programme_id,
        project_id=payload.project_id,
        notes=payload.notes,
        created_by_id=current_user.person_id,
    )

    db.add(budget)

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_CREATED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} created"
        ),
        new_values={
            "budget_number": budget.budget_number,
            "name": budget.name,
            "fiscal_year": budget.fiscal_year,
            "amount": str(budget.amount),
            "currency": budget.currency,
            "status": budget.status,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)


@router.get(
    "/budgets",
    response_model=list[BudgetResponse],
)
async def list_budgets(
    status_filter: Optional[str] = Query(
        default=None,
        alias="status",
    ),
    fiscal_year: Optional[str] = None,
    department_id: Optional[str] = None,
    programme_id: Optional[str] = None,
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    query = select(Budget)

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        conditions = []

        if current_user.person_id:
            conditions.append(
                Budget.created_by_id
                == current_user.person_id
            )

        if conditions:
            query = query.where(or_(*conditions))
        else:
            query = query.where(False)

    if status_filter:
        query = query.where(
            Budget.status == status_filter
        )

    if fiscal_year:
        query = query.where(
            Budget.fiscal_year == fiscal_year
        )

    if department_id:
        query = query.where(
            Budget.department_id == department_id
        )

    if programme_id:
        query = query.where(
            Budget.programme_id == programme_id
        )

    if project_id:
        query = query.where(
            Budget.project_id == project_id
        )

    if search:
        search_term = f"%{search.strip()}%"

        query = query.where(
            or_(
                Budget.budget_number.ilike(
                    search_term
                ),
                Budget.name.ilike(search_term),
                Budget.description.ilike(
                    search_term
                ),
            )
        )

    query = (
        query
        .order_by(Budget.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)

    budgets = result.scalars().all()

    return [
        to_response(budget)
        for budget in budgets
    ]


@router.get(
    "/budgets/{budget_id}",
    response_model=BudgetResponse,
)
async def get_budget(
    budget_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    return to_response(budget)


@router.patch(
    "/budgets/{budget_id}",
    response_model=BudgetResponse,
)
async def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    if budget.status not in {
        "draft",
        "submitted",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only draft or submitted budgets "
                "can be edited"
            ),
        )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    new_start_date = update_data.get(
        "start_date",
        budget.start_date,
    )

    new_end_date = update_data.get(
        "end_date",
        budget.end_date,
    )

    validate_dates(
        new_start_date,
        new_end_date,
    )

    old_values = {
        "name": budget.name,
        "description": budget.description,
        "fiscal_year": budget.fiscal_year,
        "start_date": (
            budget.start_date.isoformat()
            if budget.start_date
            else None
        ),
        "end_date": (
            budget.end_date.isoformat()
            if budget.end_date
            else None
        ),
        "amount": str(budget.amount),
        "currency": budget.currency,
        "department_id": (
            str(budget.department_id)
            if budget.department_id
            else None
        ),
        "programme_id": (
            str(budget.programme_id)
            if budget.programme_id
            else None
        ),
        "project_id": (
            str(budget.project_id)
            if budget.project_id
            else None
        ),
    }

    for field, value in update_data.items():
        if field == "currency" and value:
            value = value.upper()

        setattr(budget, field, value)

    await db.flush()

    new_values = {
        "name": budget.name,
        "description": budget.description,
        "fiscal_year": budget.fiscal_year,
        "start_date": (
            budget.start_date.isoformat()
            if budget.start_date
            else None
        ),
        "end_date": (
            budget.end_date.isoformat()
            if budget.end_date
            else None
        ),
        "amount": str(budget.amount),
        "currency": budget.currency,
        "department_id": (
            str(budget.department_id)
            if budget.department_id
            else None
        ),
        "programme_id": (
            str(budget.programme_id)
            if budget.programme_id
            else None
        ),
        "project_id": (
            str(budget.project_id)
            if budget.project_id
            else None
        ),
    }

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_UPDATED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} updated"
        ),
        old_values=old_values,
        new_values=new_values,
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)


@router.post(
    "/budgets/{budget_id}/submit",
    response_model=BudgetResponse,
)
async def submit_budget(
    budget_id: str,
    payload: BudgetSubmission,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    if budget.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft budgets can be submitted",
        )

    budget.status = "submitted"
    budget.submitted_at = datetime.now(timezone.utc)
    budget.submitted_by_id = current_user.person_id

    if payload.notes:
        budget.notes = payload.notes

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_SUBMITTED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} submitted"
        ),
        new_values={
            "status": budget.status,
            "submitted_at": (
                budget.submitted_at.isoformat()
            ),
            "notes": budget.notes,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)


@router.post(
    "/budgets/{budget_id}/approve",
    response_model=BudgetResponse,
)
async def approve_budget(
    budget_id: str,
    payload: BudgetApproval,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.approve")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    if budget.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only submitted budgets "
                "can be approved"
            ),
        )

    budget.status = "approved"
    budget.approved_at = datetime.now(timezone.utc)
    budget.approved_by_id = current_user.person_id

    if payload.notes:
        budget.notes = payload.notes

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_APPROVED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} approved"
        ),
        new_values={
            "status": budget.status,
            "approved_at": (
                budget.approved_at.isoformat()
            ),
            "notes": budget.notes,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)


@router.post(
    "/budgets/{budget_id}/activate",
    response_model=BudgetResponse,
)
async def activate_budget(
    budget_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    if budget.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Only approved budgets "
                "can be activated"
            ),
        )

    budget.status = "active"
    budget.activated_at = datetime.now(timezone.utc)
    budget.activated_by_id = current_user.person_id

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_ACTIVATED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} activated"
        ),
        new_values={
            "status": budget.status,
            "activated_at": (
                budget.activated_at.isoformat()
            ),
        },
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)


@router.post(
    "/budgets/{budget_id}/close",
    response_model=BudgetResponse,
)
async def close_budget(
    budget_id: str,
    payload: BudgetClosure,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    budget = await get_budget_or_404(
        db,
        budget_id,
    )

    await ensure_budget_access(
        db,
        budget,
        current_user,
    )

    if budget.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active budgets can be closed",
        )

    budget.status = "closed"
    budget.closed_at = datetime.now(timezone.utc)
    budget.closed_by_id = current_user.person_id

    budget.notes = (
        f"{budget.notes}\n\n"
        if budget.notes
        else ""
    ) + f"Closure reason: {payload.reason}"

    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="BUDGET_CLOSED",
        entity_type="Budget",
        entity_id=str(budget.id),
        description=(
            f"Budget {budget.budget_number} closed. "
            f"Reason: {payload.reason}"
        ),
        new_values={
            "status": budget.status,
            "closed_at": (
                budget.closed_at.isoformat()
            ),
            "reason": payload.reason,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(budget)

    return to_response(budget)
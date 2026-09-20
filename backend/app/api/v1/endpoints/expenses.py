from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.expense import Expense
from app.models.sql.project import Project
from app.models.sql.user import User
from app.schemas.expense import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    ExpenseReview,
    ExpenseApproval,
    ExpenseRejection,
    ExpensePayment,
    ExpenseReconciliation,
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter(
    prefix="/expenses",
    tags=["finance"],
)


def generate_expense_number() -> str:
    return (
        f"EX-{datetime.now(timezone.utc):%Y%m%d}-"
        f"{uuid4().hex[:6].upper()}"
    )


def to_response(record: Expense) -> ExpenseResponse:
    return ExpenseResponse(
        id=str(record.id),
        expense_number=record.expense_number,
        title=record.title,
        description=record.description,
        category=record.category,
        amount=record.amount,
        currency=record.currency,
        incurred_date=record.incurred_date,
        requester_id=str(record.requester_id),
        project_id=str(record.project_id) if record.project_id else None,
        programme_id=(
            str(record.programme_id)
            if record.programme_id
            else None
        ),
        department_id=(
            str(record.department_id)
            if record.department_id
            else None
        ),
        vendor_name=record.vendor_name,
        vendor_reference=record.vendor_reference,
        payment_method=record.payment_method,
        status=record.status,
        submitted_at=record.submitted_at,
        reviewed_at=record.reviewed_at,
        approved_at=record.approved_at,
        paid_at=record.paid_at,
        reconciled_at=record.reconciled_at,
        reviewer_id=(
            str(record.reviewer_id)
            if record.reviewer_id
            else None
        ),
        approver_id=(
            str(record.approver_id)
            if record.approver_id
            else None
        ),
        payer_id=(
            str(record.payer_id)
            if record.payer_id
            else None
        ),
        reconciler_id=(
            str(record.reconciler_id)
            if record.reconciler_id
            else None
        ),
        review_notes=record.review_notes,
        approval_notes=record.approval_notes,
        rejection_reason=record.rejection_reason,
        payment_notes=record.payment_notes,
        reconciliation_notes=record.reconciliation_notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post(
    "",
    response_model=ExpenseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_expense(
    payload: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    if not current_user.person_id:
        raise HTTPException(
            status_code=400,
            detail="User is not linked to a person record.",
        )

    try:
        project_id = (
            UUID(payload.project_id)
            if payload.project_id
            else None
        )

        programme_id = (
            UUID(payload.programme_id)
            if payload.programme_id
            else None
        )

        department_id = (
            UUID(payload.department_id)
            if payload.department_id
            else None
        )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="One or more project, programme, or department IDs are invalid.",
        )

    record = Expense(
        expense_number=generate_expense_number(),
        title=payload.title,
        description=payload.description,
        category=payload.category,
        amount=payload.amount,
        currency=payload.currency.upper(),
        incurred_date=payload.incurred_date,
        requester_id=current_user.person_id,
        project_id=project_id,
        programme_id=programme_id,
        department_id=department_id,
        vendor_name=payload.vendor_name,
        vendor_reference=payload.vendor_reference,
        payment_method=payload.payment_method,
        status="draft",
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.get(
    "",
    response_model=list[ExpenseResponse],
)
async def list_expenses(
    status_filter: str | None = Query(
        None,
        alias="status",
    ),
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    query = select(Expense).order_by(
        Expense.created_at.desc()
    )

    # FinanceAccessService currently scopes FundRequest.
    # Expense access is intentionally owner/project-manager
    # scoped here until the shared finance scope service is
    # expanded to cover all Finance entities.
    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        conditions = [
            Expense.requester_id == current_user.person_id,
        ]

        project_manager_subquery = (
            select(Project.id)
            .where(
                Project.manager_id
                == current_user.person_id
            )
        )

        conditions.append(
            Expense.project_id.in_(
                project_manager_subquery
            )
        )

        from sqlalchemy import or_

        query = query.where(or_(*conditions))

    if status_filter:
        query = query.where(
            Expense.status == status_filter
        )

    if category:
        query = query.where(
            Expense.category == category
        )

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        to_response(record)
        for record in records
    ]


@router.get(
    "/{expense_id}",
    response_model=ExpenseResponse,
)
async def get_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        is_owner = (
            record.requester_id
            == current_user.person_id
        )

        is_project_manager = False

        if record.project_id:
            project_result = await db.execute(
                select(Project).where(
                    Project.id == record.project_id,
                    Project.manager_id
                    == current_user.person_id,
                )
            )

            is_project_manager = (
                project_result.scalar_one_or_none()
                is not None
            )

        if not is_owner and not is_project_manager:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this expense.",
            )

    return to_response(record)


@router.patch(
    "/{expense_id}",
    response_model=ExpenseResponse,
)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.requester_id != current_user.person_id:
        raise HTTPException(
            status_code=403,
            detail="You can only edit your own expenses.",
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft expenses can be edited.",
        )

    updates = payload.model_dump(
        exclude_unset=True
    )

    try:
        for field, value in updates.items():
            if field in {
                "project_id",
                "programme_id",
                "department_id",
            } and value:
                value = UUID(value)

            if field == "currency" and value:
                value = value.upper()

            setattr(
                record,
                field,
                value,
            )

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="One or more project, programme, or department IDs are invalid.",
        )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/submit",
    response_model=ExpenseResponse,
)
async def submit_expense(
    expense_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.requester_id != current_user.person_id:
        raise HTTPException(
            status_code=403,
            detail="You can only submit your own expenses.",
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft expenses can be submitted.",
        )

    if record.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expense amount must be greater than zero.",
        )

    old_values = {
        "status": record.status,
    }

    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_SUBMITTED",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "submitted for review."
        ),
        old_values=old_values,
        new_values={
            "status": record.status,
            "submitted_at": (
                record.submitted_at.isoformat()
            ),
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/review",
    response_model=ExpenseResponse,
)
async def review_expense(
    expense_id: str,
    request: Request,
    body: ExpenseReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.review")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Only submitted expenses can be reviewed.",
        )

    old_status = record.status

    record.status = "under_review"
    record.reviewer_id = current_user.person_id
    record.reviewed_at = datetime.now(timezone.utc)
    record.review_notes = body.review_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_REVIEWED",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "moved into review."
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "reviewer_id": str(
                current_user.person_id
            ),
            "review_notes": body.review_notes,
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/approve",
    response_model=ExpenseResponse,
)
async def approve_expense(
    expense_id: str,
    request: Request,
    body: ExpenseApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.approve")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.status != "under_review":
        raise HTTPException(
            status_code=400,
            detail="Only expenses under review can be approved.",
        )

    old_status = record.status

    record.status = "approved"
    record.approver_id = current_user.person_id
    record.approved_at = datetime.now(timezone.utc)
    record.approval_notes = body.approval_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_APPROVED",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "approved."
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "approver_id": str(
                current_user.person_id
            ),
            "approval_notes": body.approval_notes,
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/reject",
    response_model=ExpenseResponse,
)
async def reject_expense(
    expense_id: str,
    request: Request,
    body: ExpenseRejection,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reject")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.status not in {
        "submitted",
        "under_review",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only submitted or reviewed "
                "expenses can be rejected."
            ),
        )

    if not body.rejection_reason.strip():
        raise HTTPException(
            status_code=400,
            detail="A rejection reason is required.",
        )

    old_status = record.status

    if old_status == "under_review":
        record.reviewer_id = current_user.person_id

    record.status = "rejected"
    record.rejection_reason = (
        body.rejection_reason
    )
    record.reviewed_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_REJECTED",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "rejected."
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "rejection_reason": (
                body.rejection_reason
            ),
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/pay",
    response_model=ExpenseResponse,
)
async def pay_expense(
    expense_id: str,
    request: Request,
    body: ExpensePayment,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.disburse")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved expenses can be paid.",
        )

    old_status = record.status

    record.status = "paid"
    record.payer_id = current_user.person_id
    record.paid_at = datetime.now(timezone.utc)
    record.payment_notes = body.payment_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_PAID",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "payment recorded."
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "payer_id": str(
                current_user.person_id
            ),
            "payment_notes": body.payment_notes,
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{expense_id}/reconcile",
    response_model=ExpenseResponse,
)
async def reconcile_expense(
    expense_id: str,
    request: Request,
    body: ExpenseReconciliation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reconcile")
    ),
):
    try:
        expense_uuid = UUID(expense_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid expense ID.",
        )

    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Expense not found.",
        )

    if record.status != "paid":
        raise HTTPException(
            status_code=400,
            detail="Only paid expenses can be reconciled.",
        )

    old_status = record.status

    record.status = "reconciled"
    record.reconciler_id = current_user.person_id
    record.reconciled_at = datetime.now(timezone.utc)
    record.reconciliation_notes = (
        body.reconciliation_notes
    )

    await AuditService.log(
        db,
        actor=current_user,
        action="EXPENSE_RECONCILED",
        entity_type="Expense",
        entity_id=record.id,
        description=(
            f"Expense {record.expense_number} "
            "reconciled."
        ),
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "reconciliation_notes": (
                body.reconciliation_notes
            ),
        },
        metadata={
            "expense_number": record.expense_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)
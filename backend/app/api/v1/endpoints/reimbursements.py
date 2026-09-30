from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.reimbursement import Reimbursement
from app.models.sql.project import Project
from app.models.sql.user import User
from app.schemas.reimbursement import (
    ReimbursementCreate,
    ReimbursementResponse,
    ReimbursementUpdate,
    ReimbursementReview,
    ReimbursementApproval,
    ReimbursementRejection,
    ReimbursementPayment,
    ReimbursementReconciliation,
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter(
    prefix="/reimbursements",
    tags=["finance"],
)


def generate_reimbursement_number() -> str:
    return (
        f"RB-{datetime.now(timezone.utc):%Y%m%d}-"
        f"{uuid4().hex[:6].upper()}"
    )


def to_response(record: Reimbursement) -> ReimbursementResponse:
    return ReimbursementResponse(
        id=str(record.id),
        reimbursement_number=record.reimbursement_number,
        title=record.title,
        description=record.description,
        category=record.category,
        amount=record.amount,
        currency=record.currency,
        incurred_date=record.incurred_date,
        requester_id=str(record.requester_id),
        project_id=(
            str(record.project_id)
            if record.project_id
            else None
        ),
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
        payment_method=record.payment_method,
        vendor_name=record.vendor_name,
        vendor_reference=record.vendor_reference,
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
    response_model=ReimbursementResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reimbursement(
    payload: ReimbursementCreate,
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
            detail=(
                "One or more project, programme, or "
                "department IDs are invalid."
            ),
        )

    record = Reimbursement(
        reimbursement_number=generate_reimbursement_number(),
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
        payment_method=payload.payment_method,
        vendor_name=payload.vendor_name,
        vendor_reference=payload.vendor_reference,
        status="draft",
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.get(
    "",
    response_model=list[ReimbursementResponse],
)
async def list_reimbursements(
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
    query = select(Reimbursement).order_by(
        Reimbursement.created_at.desc()
    )

    if not await FinanceAccessService.can_view_all(
        db,
        current_user,
    ):
        conditions = [
            Reimbursement.requester_id
            == current_user.person_id
        ]

        project_manager_subquery = (
            select(Project.id).where(
                Project.manager_id
                == current_user.person_id
            )
        )

        conditions.append(
            Reimbursement.project_id.in_(
                project_manager_subquery
            )
        )

        query = query.where(or_(*conditions))

    if status_filter:
        query = query.where(
            Reimbursement.status == status_filter
        )

    if category:
        query = query.where(
            Reimbursement.category == category
        )

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        to_response(record)
        for record in records
    ]


@router.get(
    "/{reimbursement_id}",
    response_model=ReimbursementResponse,
)
async def get_reimbursement(
    reimbursement_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
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
                detail=(
                    "You do not have access "
                    "to this reimbursement."
                ),
            )

    return to_response(record)


@router.patch(
    "/{reimbursement_id}",
    response_model=ReimbursementResponse,
)
async def update_reimbursement(
    reimbursement_id: str,
    payload: ReimbursementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.requester_id != current_user.person_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only edit your own "
                "reimbursements."
            ),
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft reimbursements "
                "can be edited."
            ),
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
            detail=(
                "One or more project, programme, "
                "or department IDs are invalid."
            ),
        )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/submit",
    response_model=ReimbursementResponse,
)
async def submit_reimbursement(
    reimbursement_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.requester_id != current_user.person_id:
        raise HTTPException(
            status_code=403,
            detail=(
                "You can only submit your own "
                "reimbursements."
            ),
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only draft reimbursements "
                "can be submitted."
            ),
        )

    if record.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Reimbursement amount must be "
                "greater than zero."
            ),
        )

    old_values = {
        "status": record.status,
    }

    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="REIMBURSEMENT_SUBMITTED",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/review",
    response_model=ReimbursementResponse,
)
async def review_reimbursement(
    reimbursement_id: str,
    request: Request,
    body: ReimbursementReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.review")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only submitted reimbursements "
                "can be reviewed."
            ),
        )

    old_status = record.status

    record.status = "under_review"
    record.reviewer_id = current_user.person_id
    record.reviewed_at = datetime.now(timezone.utc)
    record.review_notes = body.review_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="REIMBURSEMENT_REVIEWED",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/approve",
    response_model=ReimbursementResponse,
)
async def approve_reimbursement(
    reimbursement_id: str,
    request: Request,
    body: ReimbursementApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.approve")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.status != "under_review":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only reimbursements under review "
                "can be approved."
            ),
        )

    old_status = record.status

    record.status = "approved"
    record.approver_id = current_user.person_id
    record.approved_at = datetime.now(timezone.utc)
    record.approval_notes = body.approval_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="REIMBURSEMENT_APPROVED",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/reject",
    response_model=ReimbursementResponse,
)
async def reject_reimbursement(
    reimbursement_id: str,
    request: Request,
    body: ReimbursementRejection,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reject")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.status not in {
        "submitted",
        "under_review",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only submitted or reviewed "
                "reimbursements can be rejected."
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
        action="REIMBURSEMENT_REJECTED",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/pay",
    response_model=ReimbursementResponse,
)
async def pay_reimbursement(
    reimbursement_id: str,
    request: Request,
    body: ReimbursementPayment,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.disburse")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only approved reimbursements "
                "can be paid."
            ),
        )

    old_status = record.status

    record.status = "paid"
    record.payer_id = current_user.person_id
    record.paid_at = datetime.now(timezone.utc)
    record.payment_notes = body.payment_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="REIMBURSEMENT_PAID",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{reimbursement_id}/reconcile",
    response_model=ReimbursementResponse,
)
async def reconcile_reimbursement(
    reimbursement_id: str,
    request: Request,
    body: ReimbursementReconciliation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reconcile")
    ),
):
    try:
        reimbursement_uuid = UUID(reimbursement_id)

    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid reimbursement ID.",
        )

    result = await db.execute(
        select(Reimbursement).where(
            Reimbursement.id == reimbursement_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Reimbursement not found.",
        )

    if record.status != "paid":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only paid reimbursements "
                "can be reconciled."
            ),
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
        action="REIMBURSEMENT_RECONCILED",
        entity_type="Reimbursement",
        entity_id=record.id,
        description=(
            f"Reimbursement "
            f"{record.reimbursement_number} "
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
            "reimbursement_number":
                record.reimbursement_number,
            "amount": str(record.amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)
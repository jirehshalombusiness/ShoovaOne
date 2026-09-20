from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.sql.fund_request import FundRequest
from app.models.sql.project import Project
from app.models.sql.user import User
from app.schemas.finance import (
    FundRequestCreate,
    FundRequestResponse,
    FundRequestUpdate,
    FundRequestReview,
    FundRequestApproval,
    FundRequestRejection,
    FundRequestDisbursement,
    FundRequestReconciliation,
    
)
from app.services.audit_service import AuditService
from app.services.finance_access_service import FinanceAccessService


router = APIRouter(prefix="/fund-requests", tags=["finance"])


def generate_request_number() -> str:
    return f"FR-{datetime.now(timezone.utc):%Y%m%d}-{uuid4().hex[:6].upper()}"


def to_response(record: FundRequest) -> FundRequestResponse:
    return FundRequestResponse(
        id=str(record.id),
        request_number=record.request_number,
        title=record.title,
        description=record.description,
        justification=record.justification,
        requester_id=str(record.requester_id),
        project_id=str(record.project_id) if record.project_id else None,
        programme_id=str(record.programme_id) if record.programme_id else None,
        department_id=str(record.department_id) if record.department_id else None,
        amount_requested=record.amount_requested,
        currency=record.currency,
        approved_amount=record.approved_amount,
        amount_disbursed=record.amount_disbursed,
        status=record.status,
        required_by_date=record.required_by_date,
        submitted_at=record.submitted_at,
        reviewed_at=record.reviewed_at,
        approved_at=record.approved_at,
        disbursed_at=record.disbursed_at,
        reconciled_at=record.reconciled_at,
        reviewer_id=str(record.reviewer_id) if record.reviewer_id else None,
        approver_id=str(record.approver_id) if record.approver_id else None,
        disburser_id=str(record.disburser_id) if record.disburser_id else None,
        reconciler_id=str(record.reconciler_id) if record.reconciler_id else None,
        rejection_reason=record.rejection_reason,
        review_notes=record.review_notes,
        approval_notes=record.approval_notes,
        disbursement_notes=record.disbursement_notes,
        reconciliation_notes=record.reconciliation_notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post(
    "",
    response_model=FundRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_fund_request(
    payload: FundRequestCreate,
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

    record = FundRequest(
        request_number=generate_request_number(),
        title=payload.title,
        description=payload.description,
        justification=payload.justification,
        requester_id=current_user.person_id,
        project_id=UUID(payload.project_id) if payload.project_id else None,
        programme_id=UUID(payload.programme_id) if payload.programme_id else None,
        department_id=UUID(payload.department_id) if payload.department_id else None,
        amount_requested=payload.amount_requested,
        currency=payload.currency.upper(),
        status="draft",
        required_by_date=payload.required_by_date,
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.get(
    "",
    response_model=list[FundRequestResponse],
)
async def list_fund_requests(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    query = select(FundRequest).order_by(
        FundRequest.created_at.desc()
    )

    query = await FinanceAccessService.apply_view_scope(
        db,
        query,
        current_user,
    )

    if status_filter:
        query = query.where(
            FundRequest.status == status_filter
        )

    result = await db.execute(query)
    records = result.scalars().all()

    return [to_response(record) for record in records]

    


@router.get(
    "/{request_id}",
    response_model=FundRequestResponse,
)
async def get_fund_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.view")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if not await FinanceAccessService.can_view_all(db, current_user):
        is_owner = record.requester_id == current_user.person_id

        is_project_manager = False

        if record.project_id:
            project_result = await db.execute(
                select(Project).where(
                    Project.id == record.project_id,
                    Project.manager_id == current_user.person_id,
                )
            )
            is_project_manager = (
                project_result.scalar_one_or_none() is not None
            )

        if not is_owner and not is_project_manager:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this fund request.",
            )

    return to_response(record)


@router.post(
    "/{request_id}/submit",
    response_model=FundRequestResponse,
)
async def submit_fund_request(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.create")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.requester_id != current_user.person_id:
        raise HTTPException(
            status_code=403,
            detail="You can only submit your own fund requests.",
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft fund requests can be submitted.",
        )

    if record.amount_requested <= 0:
        raise HTTPException(
            status_code=400,
            detail="Fund request amount must be greater than zero.",
        )

    old_values = {
        "status": record.status,
    }

    record.status = "submitted"
    record.submitted_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_SUBMITTED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} submitted for review.",
        old_values=old_values,
        new_values={
            "status": record.status,
            "submitted_at": record.submitted_at.isoformat(),
        },
        metadata={
            "request_number": record.request_number,
            "amount_requested": str(record.amount_requested),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{request_id}/review",
    response_model=FundRequestResponse,
)
async def review_fund_request(
    request_id: str,
    request: Request,
    body: FundRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.review")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Only submitted fund requests can be reviewed.",
        )

    old_status = record.status

    record.status = "under_review"
    record.reviewer_id = current_user.person_id
    record.reviewed_at = datetime.now(timezone.utc)
    record.review_notes = body.review_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_REVIEWED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} moved into review.",
        old_values={"status": old_status},
        new_values={
            "status": record.status,
            "reviewer_id": str(current_user.person_id),
            "review_notes": body.review_notes,
        },
        metadata={
            "request_number": record.request_number,
            "amount_requested": str(record.amount_requested),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{request_id}/approve",
    response_model=FundRequestResponse,
)
async def approve_fund_request(
    request_id: str,
    request: Request,
    body: FundRequestApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.approve")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status != "under_review":
        raise HTTPException(
            status_code=400,
            detail="Only requests under review can be approved.",
        )

    if body.approved_amount is None:
        final_amount = record.amount_requested
    else:
        if body.approved_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Approved amount must be greater than zero.",
            )

        if body.approved_amount > record.amount_requested:
            raise HTTPException(
                status_code=400,
                detail="Approved amount cannot exceed requested amount.",
            )

        final_amount = body.approved_amount

    old_status = record.status
    old_approved_amount = record.approved_amount

    record.status = "approved"
    record.approved_amount = final_amount
    record.approver_id = current_user.person_id
    record.approved_at = datetime.now(timezone.utc)
    record.approval_notes = body.approval_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_APPROVED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} approved.",
        old_values={
            "status": old_status,
            "approved_amount": (
                str(old_approved_amount)
                if old_approved_amount is not None
                else None
            ),
        },
        new_values={
            "status": record.status,
            "approved_amount": str(final_amount),
            "approver_id": str(current_user.person_id),
            "approval_notes": body.approval_notes,
        },
        metadata={
            "request_number": record.request_number,
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.patch(
    "/{request_id}",
    response_model=FundRequestResponse,
)
async def update_fund_request(
    request_id: str,
    payload: FundRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.edit")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )

    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Only draft fund requests can be edited.",
        )

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if field in {
            "project_id",
            "programme_id",
            "department_id",
        } and value:
            value = UUID(value)

        if field == "currency" and value:
            value = value.upper()

        setattr(record, field, value)

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{request_id}/reject",
    response_model=FundRequestResponse,
)
async def reject_fund_request(
    request_id: str,
    request: Request,
    body: FundRequestRejection,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reject")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status not in {"submitted", "under_review"}:
        raise HTTPException(
            status_code=400,
            detail="Only submitted or reviewed requests can be rejected.",
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
    record.rejection_reason = body.rejection_reason
    record.reviewed_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_REJECTED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} rejected.",
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "rejection_reason": body.rejection_reason,
        },
        metadata={
            "request_number": record.request_number,
            "amount_requested": str(record.amount_requested),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{request_id}/disburse",
    response_model=FundRequestResponse,
)
async def disburse_fund_request(
    request_id: str,
    request: Request,
    body: FundRequestDisbursement,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.disburse")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status != "approved":
        raise HTTPException(
            status_code=400,
            detail="Only approved requests can be disbursed.",
        )

    if body.amount_disbursed <= 0:
        raise HTTPException(
            status_code=400,
            detail="Disbursement amount must be greater than zero.",
        )

    approved_amount = record.approved_amount or record.amount_requested
    remaining_amount = approved_amount - record.amount_disbursed

    if body.amount_disbursed > remaining_amount:
        raise HTTPException(
            status_code=400,
            detail="Disbursement cannot exceed the remaining approved amount.",
        )

    old_values = {
        "status": record.status,
        "amount_disbursed": str(record.amount_disbursed),
    }

    record.amount_disbursed += body.amount_disbursed
    record.disburser_id = current_user.person_id
    record.disbursement_notes = body.disbursement_notes

    if record.amount_disbursed >= approved_amount:
        record.status = "disbursed"
        record.disbursed_at = datetime.now(timezone.utc)

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_DISBURSED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} disbursement recorded.",
        old_values=old_values,
        new_values={
            "status": record.status,
            "amount_disbursed": str(record.amount_disbursed),
            "disbursement_notes": body.disbursement_notes,
        },
        metadata={
            "request_number": record.request_number,
            "approved_amount": str(approved_amount),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)


@router.post(
    "/{request_id}/reconcile",
    response_model=FundRequestResponse,
)
async def reconcile_fund_request(
    request_id: str,
    request: Request,
    body: FundRequestReconciliation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission("finance.reconcile")
    ),
):
    try:
        request_uuid = UUID(request_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid fund request ID.",
        )

    result = await db.execute(
        select(FundRequest).where(
            FundRequest.id == request_uuid
        )
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Fund request not found.",
        )

    if record.status != "disbursed":
        raise HTTPException(
            status_code=400,
            detail="Only fully disbursed requests can be reconciled.",
        )

    old_status = record.status

    record.status = "reconciled"
    record.reconciler_id = current_user.person_id
    record.reconciled_at = datetime.now(timezone.utc)
    record.reconciliation_notes = body.reconciliation_notes

    await AuditService.log(
        db,
        actor=current_user,
        action="FUND_REQUEST_RECONCILED",
        entity_type="FundRequest",
        entity_id=record.id,
        description=f"Fund request {record.request_number} reconciled.",
        old_values={
            "status": old_status,
        },
        new_values={
            "status": record.status,
            "reconciliation_notes": body.reconciliation_notes,
        },
        metadata={
            "request_number": record.request_number,
            "amount_disbursed": str(record.amount_disbursed),
            "currency": record.currency,
        },
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return to_response(record)
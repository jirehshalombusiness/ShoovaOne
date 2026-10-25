from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, require_any_permission
from app.models.pydantic.payroll.schemas import (
    DisbursementBatchCreate,
    DisbursementBatchResponse,
    DisbursementDecision,
    ReconcileBatchRequest,
    ReconcileItemRequest,
    RetryItemRequest,
)
from app.models.sql.payroll.disbursement import DisbursementBatch
from app.services.payroll.disbursement_service import (
    DisbursementService,
    batch_to_dict,
    load_batch,
)

router = APIRouter()

view_access = require_any_permission(
    [
        Permissions.PAYROLL_VIEW_ALL,
        Permissions.PAYROLL_PREPARE,
        Permissions.PAYROLL_REVIEW_FINANCE,
        Permissions.PAYROLL_APPROVE,
        Permissions.PAYROLL_DISBURSE,
        Permissions.PAYROLL_REPORTS,
    ]
)
disburse_access = require_any_permission(
    [Permissions.PAYROLL_DISBURSE, Permissions.PAYROLL_REVIEW_FINANCE]
)
batch_approval_access = require_any_permission(
    [Permissions.PAYROLL_APPROVE, Permissions.PAYROLL_REVIEW_FINANCE]
)


@router.get("/disbursements", response_model=list[DisbursementBatchResponse])
async def list_disbursement_batches(
    batch_status: Optional[str] = Query(default=None, alias="status"),
    run_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    query = (
        select(DisbursementBatch)
        .options(selectinload(DisbursementBatch.items))
        .order_by(DisbursementBatch.created_at.desc())
    )
    if batch_status:
        query = query.where(DisbursementBatch.status == batch_status)
    if run_id:
        query = query.where(DisbursementBatch.run_id == run_id)

    result = await db.execute(query.offset(offset).limit(limit))
    return [batch_to_dict(batch) for batch in result.scalars().all()]


@router.post(
    "/disbursements",
    response_model=DisbursementBatchResponse,
    status_code=201,
)
async def create_disbursement_batch(
    payload: DisbursementBatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await DisbursementService.create_batch(
        db,
        run_id=payload.run_id,
        method=payload.method,
        pay_date=payload.pay_date,
        notes=payload.notes,
        actor=current_user,
    )
    return batch_to_dict(batch)


@router.get(
    "/disbursements/{batch_id}",
    response_model=DisbursementBatchResponse,
)
async def get_disbursement_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(view_access),
):
    batch = await load_batch(db, batch_id)
    return batch_to_dict(batch)


@router.post(
    "/disbursements/{batch_id}/approve",
    response_model=DisbursementBatchResponse,
)
async def approve_disbursement_batch(
    batch_id: str,
    payload: DisbursementDecision,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(batch_approval_access),
):
    batch = await DisbursementService.approve_batch(
        db,
        batch_id=batch_id,
        actor=current_user,
        note=payload.note,
    )
    return batch_to_dict(batch)


@router.get("/disbursements/{batch_id}/bank-file")
async def download_bank_file(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await load_batch(db, batch_id, include_items=False)
    if batch.status not in {"approved", "processing", "submitted"}:
        raise HTTPException(
            status_code=409,
            detail="The batch must be approved before downloading a bank file.",
        )

    filename, content = await DisbursementService.generate_bank_file(
        db,
        batch_id=batch_id,
        actor=current_user,
    )
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/disbursements/{batch_id}/submit",
    response_model=DisbursementBatchResponse,
)
async def submit_disbursement_batch(
    batch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await DisbursementService.submit_batch(
        db,
        batch_id=batch_id,
        actor=current_user,
    )
    return batch_to_dict(batch)


@router.post(
    "/disbursements/{batch_id}/reconcile",
    response_model=DisbursementBatchResponse,
)
async def reconcile_disbursement_batch(
    batch_id: str,
    payload: ReconcileBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await DisbursementService.reconcile_batch(
        db,
        batch_id=batch_id,
        outcome=payload.outcome,
        actor=current_user,
        failure_reason=payload.failure_reason,
        provider_reference=payload.provider_reference,
    )
    return batch_to_dict(batch)


@router.post(
    "/disbursements/items/{item_id}/reconcile",
    response_model=DisbursementBatchResponse,
)
async def reconcile_disbursement_item(
    item_id: str,
    payload: ReconcileItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await DisbursementService.reconcile_item(
        db,
        item_id=item_id,
        outcome=payload.status,
        actor=current_user,
        failure_reason=payload.failure_reason,
        provider_reference=payload.provider_reference,
    )
    return batch_to_dict(batch)


@router.post(
    "/disbursements/items/{item_id}/retry",
    response_model=DisbursementBatchResponse,
)
async def retry_disbursement_item(
    item_id: str,
    payload: RetryItemRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(disburse_access),
):
    batch = await DisbursementService.retry_item(
        db,
        item_id=item_id,
        actor=current_user,
        provider_reference=payload.provider_reference,
    )
    return batch_to_dict(batch)

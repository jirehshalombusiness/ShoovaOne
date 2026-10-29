from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission
from app.models.pydantic.finance.finance import (
    FundRequestDisbursement,
    FundRequestDetailResponse,
    FundRequestReceiptVerification,
    FundRequestResponse,
)
from app.models.sql.core.user import User
from app.models.sql.finance.fund_request import FundRequest
from app.services.finance import fund_request_service
from app.services.finance.finance_access_service import FinanceAccessService


router = APIRouter(prefix="/fund-requests", tags=["finance"])


async def _load_for_finance(
    db: AsyncSession,
    request_id: str,
    current_user: User,
) -> FundRequest:
    record = await fund_request_service.get_request(db, request_id)

    if not await fund_request_service.can_view(
        db, record, current_user
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this fund request.",
        )

    return record


@router.get(
    "",
    response_model=list[FundRequestResponse],
)
async def list_fund_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    stage: Optional[str] = Query(None),
    request_type: Optional[str] = Query(None),
    requester_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view")),
):
    query = select(FundRequest).order_by(FundRequest.created_at.desc())

    query = await FinanceAccessService.apply_view_scope(
        db,
        query,
        current_user,
    )

    model = FundRequest

    if status_filter and status_filter != "all":
        query = query.where(model.status == status_filter)

    if stage:
        query = query.where(model.current_stage == stage)

    if request_type:
        query = query.where(model.request_type == request_type)

    if requester_id:
        query = query.where(model.requester_id == requester_id)

    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                model.title.ilike(term),
                model.request_number.ilike(term),
            )
        )

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        await fund_request_service.to_response(db, record)
        for record in records
    ]


@router.get(
    "/{request_id}",
    response_model=FundRequestDetailResponse,
)
async def get_fund_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view")),
):
    record = await _load_for_finance(db, request_id, current_user)
    return await fund_request_service.to_detail(db, record)


@router.post(
    "/{request_id}/disburse",
    response_model=FundRequestResponse,
)
async def disburse_fund_request(
    request_id: str,
    body: FundRequestDisbursement,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.disburse")),
):
    record = await _load_for_finance(db, request_id, current_user)

    await fund_request_service.disburse(
        db,
        record,
        actor=current_user,
        amount=body.amount_disbursed,
        notes=body.disbursement_notes,
        request=request,
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)


@router.post(
    "/{request_id}/verify-receipt",
    response_model=FundRequestResponse,
)
async def verify_fund_request_receipt(
    request_id: str,
    body: FundRequestReceiptVerification,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("finance.verify")),
):
    record = await _load_for_finance(db, request_id, current_user)

    await fund_request_service.verify_receipt(
        db,
        record,
        actor=current_user,
        verified=body.verified,
        note=body.note,
        receipt_reference=body.receipt_reference,
        request=request,
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)

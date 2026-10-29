from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.pydantic.finance.finance import (
    FundRequestCreate,
    FundRequestDetailResponse,
    FundRequestResponse,
    FundRequestUpdate,
)
from app.models.sql.core.user import User
from app.models.sql.finance.fund_request import FundRequest
from app.services.finance import fund_request_service


router = APIRouter(prefix="/fund-requests", tags=["finance"])


@router.post(
    "",
    response_model=FundRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_fund_request(
    payload: FundRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.create_request(
        db, payload, current_user
    )

    await db.commit()
    await db.refresh(record)

    return await fund_request_service.to_response(db, record)


@router.get(
    "",
    response_model=list[FundRequestResponse],
)
async def list_my_fund_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not current_user.person_id:
        return []

    query = (
        select(FundRequest)
        .where(FundRequest.requester_id == current_user.person_id)
        .order_by(FundRequest.created_at.desc())
    )

    if status_filter and status_filter != "all":
        query = query.where(FundRequest.status == status_filter)

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)

    return [
        await fund_request_service.to_response(db, record)
        for record in result.scalars().all()
    ]


@router.get(
    "/{request_id}",
    response_model=FundRequestDetailResponse,
)
async def get_my_fund_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.get_request(db, request_id)
    fund_request_service.assert_owner(record, current_user)

    return await fund_request_service.to_detail(db, record)


@router.patch(
    "/{request_id}",
    response_model=FundRequestResponse,
)
async def update_my_fund_request(
    request_id: str,
    payload: FundRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.get_request(db, request_id)

    await fund_request_service.update_request(
        db, record, payload, current_user
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)


@router.post(
    "/{request_id}/submit",
    response_model=FundRequestResponse,
)
async def submit_my_fund_request(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.get_request(db, request_id)

    await fund_request_service.submit_request(
        db, record, current_user, request
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)


@router.post(
    "/{request_id}/cancel",
    response_model=FundRequestResponse,
)
async def cancel_my_fund_request(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.get_request(db, request_id)

    await fund_request_service.cancel_request(
        db, record, current_user, request
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)


@router.post(
    "/{request_id}/resubmit-receipt",
    response_model=FundRequestResponse,
)
async def resubmit_my_receipt(
    request_id: str,
    request: Request,
    note: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await fund_request_service.get_request(db, request_id)

    await fund_request_service.resubmit_receipt(
        db, record, actor=current_user, note=note, request=request
    )

    await db.commit()

    return await fund_request_service.to_response(db, record)

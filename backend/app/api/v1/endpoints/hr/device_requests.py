from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user, require_permission
from app.models.pydantic.hr.device_request import (
    DeviceRequestCreate,
    DeviceRequestDetailResponse,
    DeviceRequestFulfilAssign,
    DeviceRequestFulfilPurchase,
    DeviceRequestResponse,
    DeviceRequestUpdate,
    DeviceStockItem,
)
from app.models.sql.core.user import User
from app.models.sql.hr.device_request import DeviceRequest
from app.services.hr import device_request_service


router = APIRouter(prefix="/device-requests", tags=["me-devices"])
admin_router = APIRouter(tags=["hr-devices"])


# ============================================================
# MY DEVICE REQUESTS
# ============================================================

@router.post(
    "",
    response_model=DeviceRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_device_request(
    payload: DeviceRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await device_request_service.create_request(
        db, payload, current_user
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)


@router.get("", response_model=list[DeviceRequestResponse])
async def list_my_device_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    if not current_user.person_id:
        return []

    query = (
        select(DeviceRequest)
        .where(DeviceRequest.requester_id == current_user.person_id)
        .order_by(DeviceRequest.created_at.desc())
    )

    if status_filter and status_filter != "all":
        query = query.where(DeviceRequest.status == status_filter)

    query = query.offset(offset).limit(limit)

    records = (await db.execute(query)).scalars().all()

    return [
        await device_request_service.to_response(db, record)
        for record in records
    ]


@router.get(
    "/{request_id}",
    response_model=DeviceRequestDetailResponse,
)
async def get_my_device_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await device_request_service.get_request(db, request_id)
    device_request_service.assert_owner(record, current_user)

    return await device_request_service.to_detail(db, record)


@router.patch(
    "/{request_id}",
    response_model=DeviceRequestResponse,
)
async def update_my_device_request(
    request_id: str,
    payload: DeviceRequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await device_request_service.get_request(db, request_id)

    await device_request_service.update_request(
        db, record, payload, current_user
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)


@router.post(
    "/{request_id}/submit",
    response_model=DeviceRequestResponse,
)
async def submit_my_device_request(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await device_request_service.get_request(db, request_id)

    await device_request_service.submit_request(
        db, record, current_user, request
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)


@router.post(
    "/{request_id}/cancel",
    response_model=DeviceRequestResponse,
)
async def cancel_my_device_request(
    request_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    record = await device_request_service.get_request(db, request_id)

    await device_request_service.cancel_request(
        db, record, current_user, request
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)


# ============================================================
# HR QUEUE
# ============================================================

@admin_router.get("", response_model=list[DeviceRequestResponse])
async def list_device_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    stage: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("devices.view")),
):
    query = select(DeviceRequest).order_by(
        DeviceRequest.created_at.desc()
    )

    if status_filter and status_filter != "all":
        query = query.where(DeviceRequest.status == status_filter)

    if stage:
        query = query.where(DeviceRequest.current_stage == stage)

    query = query.offset(offset).limit(limit)

    records = (await db.execute(query)).scalars().all()

    return [
        await device_request_service.to_response(db, record)
        for record in records
    ]


@admin_router.get("/stock", response_model=list[DeviceStockItem])
async def list_device_stock(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("devices.view")),
):
    return await device_request_service.list_available_devices(db)


@admin_router.get(
    "/{request_id}",
    response_model=DeviceRequestDetailResponse,
)
async def get_device_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("devices.view")),
):
    record = await device_request_service.get_request(db, request_id)
    return await device_request_service.to_detail(db, record)


@admin_router.post(
    "/{request_id}/fulfil/assign",
    response_model=DeviceRequestResponse,
)
async def assign_device_to_request(
    request_id: str,
    body: DeviceRequestFulfilAssign,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("devices.manage")),
):
    record = await device_request_service.get_request(db, request_id)

    await device_request_service.fulfil_with_device(
        db,
        record,
        actor=current_user,
        device_id=body.device_id,
        note=body.note,
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)


@admin_router.post(
    "/{request_id}/fulfil/purchase",
    response_model=DeviceRequestResponse,
)
async def record_device_purchase(
    request_id: str,
    body: DeviceRequestFulfilPurchase,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("devices.manage")),
):
    record = await device_request_service.get_request(db, request_id)

    await device_request_service.mark_purchase(
        db,
        record,
        actor=current_user,
        purchase_reference=body.purchase_reference,
        note=body.note,
        request=request,
    )

    await db.commit()
    await db.refresh(record)

    return await device_request_service.to_response(db, record)

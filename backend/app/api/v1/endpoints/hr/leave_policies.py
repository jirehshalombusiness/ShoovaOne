from datetime import date
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import User
from app.models.sql.leave import LeaveType, LeaveBalance
from app.models.sql.public_holiday import PublicHoliday
from app.services.audit_service import AuditService


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class LeaveTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=20)
    default_days: int = Field(0, ge=0, le=365)
    is_paid: bool = True
    requires_approval: bool = True
    requires_documentation: bool = False
    color: str = Field("#176b4d", max_length=20)
    is_active: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    default_days: Optional[int] = Field(None, ge=0, le=365)
    is_paid: Optional[bool] = None
    requires_approval: Optional[bool] = None
    requires_documentation: Optional[bool] = None
    color: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


class LeaveTypeResponse(LeaveTypeBase):
    id: str
    balances_count: int = 0


class HolidayBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    holiday_date: date
    country: str = Field("GH", max_length=10)
    is_paid: bool = True
    notes: Optional[str] = None


class HolidayCreate(HolidayBase):
    pass


class HolidayUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    holiday_date: Optional[date] = None
    country: Optional[str] = Field(None, max_length=10)
    is_paid: Optional[bool] = None
    notes: Optional[str] = None


class HolidayResponse(HolidayBase):
    id: str


# ============================================================
# LEAVE TYPES
# ============================================================

@router.get("/types", response_model=List[LeaveTypeResponse])
async def list_leave_types(
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """All leave types. Set include_inactive=true to see retired types."""
    query = select(LeaveType)
    if not include_inactive:
        query = query.where(LeaveType.is_active.is_(True))
    query = query.order_by(LeaveType.name)

    result = await db.execute(query)
    types = list(result.scalars().all())

    # Count balances per type
    counts_result = await db.execute(
        select(LeaveBalance.leave_type_id, func.count(LeaveBalance.id))
        .group_by(LeaveBalance.leave_type_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    return [
        LeaveTypeResponse(
            id=t.id,
            name=t.name,
            code=t.code,
            default_days=t.default_days or 0,
            is_paid=bool(t.is_paid),
            requires_approval=bool(t.requires_approval),
            requires_documentation=bool(t.requires_documentation),
            color=t.color or "#176b4d",
            is_active=bool(t.is_active),
            balances_count=counts.get(t.id, 0),
        )
        for t in types
    ]


@router.post(
    "/types",
    response_model=LeaveTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_leave_type(
    payload: LeaveTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    # Ensure unique name + code
    existing_name = await db.execute(
        select(LeaveType).where(LeaveType.name == payload.name)
    )
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A leave type with that name already exists")

    existing_code = await db.execute(
        select(LeaveType).where(LeaveType.code == payload.code)
    )
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A leave type with that code already exists")

    leave_type = LeaveType(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
    )
    db.add(leave_type)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEAVE_TYPE_CREATED",
        entity_type="leave_type",
        entity_id=leave_type.id,
        description=f"Created leave type '{payload.name}'",
        new_values=payload.model_dump(),
    )

    await db.commit()
    await db.refresh(leave_type)

    return LeaveTypeResponse(
        id=leave_type.id,
        name=leave_type.name,
        code=leave_type.code,
        default_days=leave_type.default_days or 0,
        is_paid=bool(leave_type.is_paid),
        requires_approval=bool(leave_type.requires_approval),
        requires_documentation=bool(leave_type.requires_documentation),
        color=leave_type.color or "#176b4d",
        is_active=bool(leave_type.is_active),
        balances_count=0,
    )


@router.patch("/types/{type_id}", response_model=LeaveTypeResponse)
async def update_leave_type(
    type_id: str,
    payload: LeaveTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    result = await db.execute(select(LeaveType).where(LeaveType.id == type_id))
    leave_type = result.scalar_one_or_none()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    changes = payload.model_dump(exclude_unset=True)
    old_values = {}
    for key, value in changes.items():
        old_values[key] = getattr(leave_type, key, None)
        setattr(leave_type, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEAVE_TYPE_UPDATED",
        entity_type="leave_type",
        entity_id=leave_type.id,
        description=f"Updated leave type '{leave_type.name}'",
        old_values=old_values,
        new_values=changes,
    )

    await db.commit()
    await db.refresh(leave_type)

    counts_result = await db.execute(
        select(func.count(LeaveBalance.id)).where(
            LeaveBalance.leave_type_id == leave_type.id
        )
    )
    balances_count = counts_result.scalar() or 0

    return LeaveTypeResponse(
        id=leave_type.id,
        name=leave_type.name,
        code=leave_type.code,
        default_days=leave_type.default_days or 0,
        is_paid=bool(leave_type.is_paid),
        requires_approval=bool(leave_type.requires_approval),
        requires_documentation=bool(leave_type.requires_documentation),
        color=leave_type.color or "#176b4d",
        is_active=bool(leave_type.is_active),
        balances_count=balances_count,
    )


@router.delete("/types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_leave_type(
    type_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    """
    Delete a leave type only if it has no balance rows.
    Otherwise soft-delete by setting is_active=False.
    """
    result = await db.execute(select(LeaveType).where(LeaveType.id == type_id))
    leave_type = result.scalar_one_or_none()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    counts_result = await db.execute(
        select(func.count(LeaveBalance.id)).where(
            LeaveBalance.leave_type_id == leave_type.id
        )
    )
    if (counts_result.scalar() or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete a leave type that has balances. Deactivate it instead.",
        )

    await db.delete(leave_type)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEAVE_TYPE_DELETED",
        entity_type="leave_type",
        entity_id=type_id,
        description=f"Deleted leave type '{leave_type.name}'",
    )

    await db.commit()
    return None


# ============================================================
# PUBLIC HOLIDAYS
# ============================================================

@router.get("/holidays", response_model=List[HolidayResponse])
async def list_holidays(
    year: Optional[int] = None,
    country: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_VIEW_LEAVE)),
):
    """
    Public holidays. Defaults to the current year.
    """
    if year is None:
        year = date.today().year

    query = select(PublicHoliday).where(
        func.extract("year", PublicHoliday.holiday_date) == year
    )
    if country:
        query = query.where(PublicHoliday.country == country)
    query = query.order_by(PublicHoliday.holiday_date)

    result = await db.execute(query)
    holidays = list(result.scalars().all())

    return [
        HolidayResponse(
            id=h.id,
            name=h.name,
            holiday_date=h.holiday_date,
            country=h.country,
            is_paid=bool(h.is_paid),
            notes=h.notes,
        )
        for h in holidays
    ]


@router.post(
    "/holidays",
    response_model=HolidayResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_holiday(
    payload: HolidayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    holiday = PublicHoliday(
        id=str(uuid.uuid4()),
        **payload.model_dump(),
    )
    db.add(holiday)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HOLIDAY_CREATED",
        entity_type="public_holiday",
        entity_id=holiday.id,
        description=f"Added holiday '{payload.name}' on {payload.holiday_date}",
        new_values=payload.model_dump(mode="json"),
    )

    await db.commit()
    await db.refresh(holiday)

    return HolidayResponse(
        id=holiday.id,
        name=holiday.name,
        holiday_date=holiday.holiday_date,
        country=holiday.country,
        is_paid=bool(holiday.is_paid),
        notes=holiday.notes,
    )


@router.patch("/holidays/{holiday_id}", response_model=HolidayResponse)
async def update_holiday(
    holiday_id: str,
    payload: HolidayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    result = await db.execute(
        select(PublicHoliday).where(PublicHoliday.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    changes = payload.model_dump(exclude_unset=True)
    old_values = {}
    for key, value in changes.items():
        old_values[key] = getattr(holiday, key, None)
        setattr(holiday, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HOLIDAY_UPDATED",
        entity_type="public_holiday",
        entity_id=holiday.id,
        description=f"Updated holiday '{holiday.name}'",
        old_values={k: str(v) if v is not None else None for k, v in old_values.items()},
        new_values={k: str(v) if v is not None else None for k, v in changes.items()},
    )

    await db.commit()
    await db.refresh(holiday)

    return HolidayResponse(
        id=holiday.id,
        name=holiday.name,
        holiday_date=holiday.holiday_date,
        country=holiday.country,
        is_paid=bool(holiday.is_paid),
        notes=holiday.notes,
    )


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holiday(
    holiday_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.HR_EDIT_LEAVE)),
):
    result = await db.execute(
        select(PublicHoliday).where(PublicHoliday.id == holiday_id)
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")

    name = holiday.name
    await db.delete(holiday)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="HOLIDAY_DELETED",
        entity_type="public_holiday",
        entity_id=holiday_id,
        description=f"Deleted holiday '{name}'",
    )

    await db.commit()
    return None
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import List
from datetime import date, datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.user import Person
from app.models.sql.public_holiday import PublicHoliday
from app.models.sql.device import Device, DeviceAssignment
from app.models.sql.employment_contract import EmploymentContract
from app.models.sql.leave import LeaveType, LeaveBalance, LeaveRequest
from app.models.sql.document import Document
from app.models.pydantic.hr_self import (
    HolidayResponse,
    LeaveTypeResponse,
    LeaveBalanceResponse,
    LeaveRequestResponse,
    LeaveRequestCreate,
    DeviceResponse,
    ContractResponse,
)

router = APIRouter()


# ============================================
# HOME — Personal HR dashboard
# ============================================

@router.get("/home")
async def get_my_hr_home(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Personal HR dashboard data."""
    today = date.today()
    current_year = today.year

    # Person info
    result = await db.execute(
        select(Person).where(Person.id == current_user.person_id)
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Leave balances (current year)
    bal_result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.person_id == current_user.person_id,
            LeaveBalance.year == current_year,
        )
    )
    balances = bal_result.scalars().all()

    balances_resp = [
        {
            "id": str(b.id),
            "leave_type_id": str(b.leave_type_id),
            "leave_type_name": b.leave_type.name if b.leave_type else "Unknown",
            "leave_type_color": b.leave_type.color if b.leave_type else "#176b4d",
            "year": b.year,
            "total_days": float(b.total_days or 0),
            "used_days": float(b.used_days or 0),
            "pending_days": float(b.pending_days or 0),
            "carry_over_days": float(b.carry_over_days or 0),
            "remaining_days": float(b.total_days or 0) - float(b.used_days or 0) - float(b.pending_days or 0),
        }
        for b in balances
    ]

    # Upcoming holidays (next 90 days)
    holidays_result = await db.execute(
        select(PublicHoliday)
        .where(
            PublicHoliday.holiday_date >= today,
            PublicHoliday.holiday_date <= today + timedelta(days=90),
        )
        .order_by(PublicHoliday.holiday_date)
        .limit(5)
    )
    holidays = holidays_result.scalars().all()

    # Recent leave requests (last 5)
    req_result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.person_id == current_user.person_id)
        .order_by(LeaveRequest.created_at.desc())
        .limit(5)
    )
    requests = req_result.scalars().all()

    # Devices count
    dev_count_result = await db.execute(
        select(func.count(DeviceAssignment.id)).where(
            DeviceAssignment.person_id == current_user.person_id,
            DeviceAssignment.returned_at.is_(None),
        )
    )
    devices_count = dev_count_result.scalar() or 0

    # Documents pending verification
    docs_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.related_entity_type == "person",
            Document.related_entity_id == current_user.person_id,
            Document.deleted_at.is_(None),
            Document.verified.is_(False),
        )
    )
    docs_pending = docs_result.scalar() or 0

    return {
        "person": {
            "id": str(person.id),
            "first_name": person.first_name,
            "last_name": person.last_name,
            "job_title": getattr(person, "job_title", None),
            "profile_image_url": person.profile_image_url,
        },
        "balances": balances_resp,
        "upcoming_holidays": [
            {
                "id": str(h.id),
                "name": h.name,
                "holiday_date": h.holiday_date.isoformat(),
                "country": h.country,
                "is_paid": h.is_paid,
            }
            for h in holidays
        ],
        "recent_requests": [
            {
                "id": str(r.id),
                "leave_type_id": str(r.leave_type_id),
                "leave_type_name": r.leave_type.name if r.leave_type else "Unknown",
                "leave_type_color": r.leave_type.color if r.leave_type else "#176b4d",
                "start_date": r.start_date.isoformat(),
                "end_date": r.end_date.isoformat(),
                "total_days": float(r.total_days or 0),
                "reason": r.reason,
                "status": r.status,
                "approved_at": r.approved_at.isoformat() if r.approved_at else None,
                "rejection_reason": r.rejection_reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in requests
        ],
        "devices_count": devices_count,
        "documents_pending": docs_pending,
    }


# ============================================
# TIME OFF
# ============================================

@router.get("/time-off/balances")
async def get_my_balances(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get my leave balances for current year."""
    current_year = date.today().year

    result = await db.execute(
        select(LeaveBalance)
        .options(selectinload(LeaveBalance.leave_type))
        .where(
            LeaveBalance.person_id == current_user.person_id,
            LeaveBalance.year == current_year,
        )
    )
    balances = result.scalars().all()

    return [
        {
            "id": str(b.id),
            "leave_type_id": str(b.leave_type_id),
            "leave_type_name": b.leave_type.name if b.leave_type else "Unknown",
            "leave_type_color": b.leave_type.color if b.leave_type else "#176b4d",
            "year": b.year,
            "total_days": float(b.total_days or 0),
            "used_days": float(b.used_days or 0),
            "pending_days": float(b.pending_days or 0),
            "carry_over_days": float(b.carry_over_days or 0),
            "remaining_days": float(b.total_days or 0) - float(b.used_days or 0) - float(b.pending_days or 0),
        }
        for b in balances
    ]


@router.get("/time-off/types")
async def get_leave_types(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get all active leave types."""
    result = await db.execute(
        select(LeaveType).where(LeaveType.is_active.is_(True)).order_by(LeaveType.name)
    )
    types = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "name": t.name,
            "code": t.code,
            "default_days": t.default_days,
            "is_paid": t.is_paid,
            "color": t.color,
            "requires_documentation": t.requires_documentation,
        }
        for t in types
    ]


@router.get("/time-off/requests")
async def get_my_leave_requests(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get all my leave requests."""
    result = await db.execute(
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.leave_type))
        .where(LeaveRequest.person_id == current_user.person_id)
        .order_by(LeaveRequest.created_at.desc())
    )
    requests = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "leave_type_id": str(r.leave_type_id),
            "leave_type_name": r.leave_type.name if r.leave_type else "Unknown",
            "leave_type_color": r.leave_type.color if r.leave_type else "#176b4d",
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat(),
            "total_days": float(r.total_days or 0),
            "reason": r.reason,
            "status": r.status,
            "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            "rejection_reason": r.rejection_reason,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in requests
    ]


@router.post("/time-off/requests")
async def create_leave_request(
    payload: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Create a new leave request."""
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Calculate working days (excludes weekends)
    total_days = 0
    current = payload.start_date
    while current <= payload.end_date:
        if current.weekday() < 5:  # Mon-Fri
            total_days += 1
        current += timedelta(days=1)

    if total_days <= 0:
        raise HTTPException(status_code=400, detail="No working days in selected range")

    req = LeaveRequest(
        id=str(uuid.uuid4()),
        person_id=current_user.person_id,
        leave_type_id=payload.leave_type_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=total_days,
        reason=payload.reason,
        status="pending",
    )
    db.add(req)

    # Update pending days in balance
    bal_result = await db.execute(
        select(LeaveBalance).where(
            LeaveBalance.person_id == current_user.person_id,
            LeaveBalance.leave_type_id == payload.leave_type_id,
            LeaveBalance.year == payload.start_date.year,
        )
    )
    balance = bal_result.scalar_one_or_none()
    if balance:
        balance.pending_days = float(balance.pending_days or 0) + total_days

    await db.commit()

    return {
        "id": str(req.id),
        "total_days": total_days,
        "status": "pending",
    }


# ============================================
# DEVICES
# ============================================

@router.get("/devices")
async def get_my_devices(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get all devices assigned to me."""
    result = await db.execute(
        select(DeviceAssignment)
        .options(selectinload(DeviceAssignment.device))
        .where(
            DeviceAssignment.person_id == current_user.person_id,
            DeviceAssignment.returned_at.is_(None),
        )
        .order_by(DeviceAssignment.assigned_at.desc())
    )
    assignments = result.scalars().all()

    return [
        {
            "id": str(a.device.id) if a.device else "",
            "assignment_id": str(a.id),
            "name": a.device.name if a.device else "",
            "category": a.device.category if a.device else "",
            "serial_number": a.device.serial_number if a.device else None,
            "brand": a.device.brand if a.device else None,
            "model": a.device.model if a.device else None,
            "condition": a.device.condition if a.device else "good",
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
        }
        for a in assignments
    ]


# ============================================
# CONTRACT
# ============================================

@router.get("/contracts")
async def get_my_contracts(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get my employment contracts."""
    result = await db.execute(
        select(EmploymentContract)
        .options(selectinload(EmploymentContract.reports_to))
        .where(EmploymentContract.person_id == current_user.person_id)
        .order_by(EmploymentContract.start_date.desc())
    )
    contracts = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "contract_type": c.contract_type,
            "position": c.position,
            "department": c.department,
            "start_date": c.start_date.isoformat(),
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "reports_to_id": str(c.reports_to_id) if c.reports_to_id else None,
            "reports_to_name": (
                f"{c.reports_to.first_name} {c.reports_to.last_name}"
                if c.reports_to
                else None
            ),
            "compensation_amount": float(c.compensation_amount) if c.compensation_amount else None,
            "compensation_currency": c.compensation_currency,
            "compensation_frequency": c.compensation_frequency,
            "document_id": str(c.document_id) if c.document_id else None,
            "is_current": c.is_current,
        }
        for c in contracts
    ]


# ============================================
# HOLIDAYS
# ============================================

@router.get("/holidays")
async def get_upcoming_holidays(
    days_ahead: int = 365,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get upcoming public holidays."""
    today = date.today()
    result = await db.execute(
        select(PublicHoliday)
        .where(
            PublicHoliday.holiday_date >= today,
            PublicHoliday.holiday_date <= today + timedelta(days=days_ahead),
        )
        .order_by(PublicHoliday.holiday_date)
    )
    holidays = result.scalars().all()

    return [
        {
            "id": str(h.id),
            "name": h.name,
            "holiday_date": h.holiday_date.isoformat(),
            "country": h.country,
            "is_paid": h.is_paid,
        }
        for h in holidays
    ]
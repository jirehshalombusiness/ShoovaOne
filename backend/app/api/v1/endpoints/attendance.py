from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date, datetime, timezone

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.attendance import Attendance
from app.models.pydantic.attendance import AttendanceResponse, AttendanceUpdate

router = APIRouter()


@router.get("/", response_model=List[AttendanceResponse])
async def get_attendance(
    person_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.ATTENDANCE_VIEW)),
):
    """Get attendance records."""
    query = select(Attendance)
    
    if person_id:
        query = query.where(Attendance.person_id == person_id)
    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)
    
    query = query.offset(skip).limit(limit).order_by(Attendance.date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/today", response_model=Optional[AttendanceResponse])
async def get_today_attendance(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.ATTENDANCE_CHECKIN)),
):
    """Get today's attendance for current user."""
    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today
        )
    )
    return result.scalar_one_or_none()


@router.post("/checkin", response_model=AttendanceResponse)
async def check_in(
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.ATTENDANCE_CHECKIN)),
):
    """Check in for today."""
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="Already checked in today")

    import uuid
    attendance = Attendance(
        id=str(uuid.uuid4()),
        person_id=current_user.person_id,
        date=today,
        check_in=datetime.now(timezone.utc),   # ← timezone-aware
        status="present",
        notes=notes,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.post("/checkout", response_model=AttendanceResponse)
async def check_out(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.ATTENDANCE_CHECKIN)),
):
    """Check out for today."""
    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = result.scalar_one_or_none()

    if not attendance:
        raise HTTPException(status_code=404, detail="No check-in found for today")

    if attendance.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")

    now = datetime.now(timezone.utc)
    attendance.check_out = now

    if attendance.check_in:
        # Make sure both are timezone-aware
        check_in = attendance.check_in
        if check_in.tzinfo is None:
            check_in = check_in.replace(tzinfo=timezone.utc)
        duration = (now - check_in).total_seconds() / 60
        attendance.duration_minutes = int(duration)

    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.put("/{attendance_id}", response_model=AttendanceResponse)
async def update_attendance(
    attendance_id: str,
    attendance_data: AttendanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.ATTENDANCE_EDIT)),
):
    """Update attendance record."""
    result = await db.execute(
        select(Attendance).where(Attendance.id == attendance_id)
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance not found")
    
    for key, value in attendance_data.model_dump(exclude_unset=True).items():
        setattr(attendance, key, value)
    
    await db.commit()
    await db.refresh(attendance)
    return attendance
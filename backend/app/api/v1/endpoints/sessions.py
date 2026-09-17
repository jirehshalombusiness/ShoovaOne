from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.attendance import Attendance
from app.models.sql.work_session import WorkSession
from app.models.sql.timesheet import Timesheet, TimesheetEntry

router = APIRouter()

STANDARD_MINUTES = 8 * 60  # 8 hours


def _aware(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ============================================
# SESSION STATE
# ============================================

@router.get("/status")
async def get_session_status(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """
    Return today's session state: attendance, active session, running minutes.
    Used by frontend heartbeat loop.
    """
    today = date.today()

    # Get attendance
    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()

    if not attendance:
        return {
            "has_attendance": False,
            "status": "not_started",
            "session": None,
            "total_minutes": 0,
            "standard_minutes": 0,
            "overtime_minutes": 0,
        }

    # Get active session
    session_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    active_session = session_result.scalar_one_or_none()

    # Compute total minutes from ended sessions + active session
    ended_result = await db.execute(
        select(func.sum(WorkSession.duration_minutes)).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "ended",
        )
    )
    ended_minutes = ended_result.scalar() or 0

    active_minutes = 0
    if active_session:
        delta = datetime.now(timezone.utc) - _aware(active_session.started_at)
        active_minutes = int(delta.total_seconds() / 60)

    total_minutes = ended_minutes + active_minutes
    overtime = max(0, total_minutes - STANDARD_MINUTES)
    standard = min(total_minutes, STANDARD_MINUTES)

    return {
        "has_attendance": True,
        "attendance_id": str(attendance.id),
        "work_type": attendance.work_type or "office",
        "check_in": _aware(attendance.check_in).isoformat() if attendance.check_in else None,
        "check_out": _aware(attendance.check_out).isoformat() if attendance.check_out else None,
        "status": attendance.current_status or "not_started",
        "session": (
            {
                "id": str(active_session.id),
                "started_at": _aware(active_session.started_at).isoformat(),
                "last_activity_at": _aware(active_session.last_activity_at).isoformat(),
            }
            if active_session
            else None
        ),
        "total_minutes": total_minutes,
        "standard_minutes": standard,
        "overtime_minutes": overtime,
    }


# ============================================
# START SESSION (called after check-in)
# ============================================

@router.post("/start")
async def start_session(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Start a new work session for today."""
    today = date.today()

    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=400, detail="Check in first")

    if attendance.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")

    # Close any dangling active sessions
    active_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    for s in active_result.scalars().all():
        s.status = "ended"
        s.end_reason = "restart"
        s.ended_at = datetime.now(timezone.utc)
        if s.started_at:
            s.duration_minutes = int(
                (s.ended_at - _aware(s.started_at)).total_seconds() / 60
            )

    # Start new session
    session = WorkSession(
        id=str(uuid.uuid4()),
        attendance_id=attendance.id,
        person_id=current_user.person_id,
        started_at=datetime.now(timezone.utc),
        last_activity_at=datetime.now(timezone.utc),
        status="active",
    )
    db.add(session)
    attendance.current_status = "active"
    attendance.last_heartbeat_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "session_id": str(session.id),
        "started_at": session.started_at.isoformat(),
    }


# ============================================
# HEARTBEAT (every 5 min while active)
# ============================================

@router.post("/heartbeat")
async def heartbeat(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Update last activity timestamp on active session."""
    today = date.today()

    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=400, detail="No attendance")

    now = datetime.now(timezone.utc)

    session_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    session = session_result.scalar_one_or_none()

    if not session:
        # Auto-start a new session if there isn't one
        session = WorkSession(
            id=str(uuid.uuid4()),
            attendance_id=attendance.id,
            person_id=current_user.person_id,
            started_at=now,
            last_activity_at=now,
            status="active",
        )
        db.add(session)

    session.last_activity_at = now
    attendance.last_heartbeat_at = now
    attendance.current_status = "active"
    await db.commit()

    return {"ok": True}


# ============================================
# PAUSE (user went idle)
# ============================================

@router.post("/pause")
async def pause_session(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """End the active session because user is idle."""
    today = date.today()

    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()
    if not attendance:
        return {"ok": True}

    now = datetime.now(timezone.utc)

    session_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    session = session_result.scalar_one_or_none()
    if session:
        session.status = "ended"
        session.end_reason = "idle_timeout"
        session.ended_at = now
        if session.started_at:
            session.duration_minutes = int(
                (now - _aware(session.started_at)).total_seconds() / 60
            )

    attendance.current_status = "idle"
    await db.commit()

    return {"ok": True}


# ============================================
# AUTO SIGN-OUT (30 min idle)
# ============================================

@router.post("/auto-end")
async def auto_end_session(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """
    User was away for 30+ minutes. End the day's session.
    Time will be recorded, user must log in again to resume.
    """
    today = date.today()

    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()
    if not attendance:
        return {"ok": True}

    now = datetime.now(timezone.utc)

    # End any active session
    session_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    session = session_result.scalar_one_or_none()
    if session:
        session.status = "ended"
        session.end_reason = "auto_ended"
        session.ended_at = now
        if session.started_at:
            session.duration_minutes = int(
                (now - _aware(session.started_at)).total_seconds() / 60
            )

    attendance.current_status = "away"
    await db.commit()

    return {"ok": True, "message": "Session auto-ended due to inactivity"}


# ============================================
# CHECK OUT (end of day)
# ============================================

@router.post("/checkout")
async def session_checkout(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """
    End the day. Generate timesheet entries from accumulated session minutes.
    """
    today = date.today()

    att_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )
    attendance = att_result.scalar_one_or_none()
    if not attendance:
        raise HTTPException(status_code=404, detail="No attendance found")

    if attendance.check_out:
        raise HTTPException(status_code=400, detail="Already checked out today")

    now = datetime.now(timezone.utc)

    # End active session
    session_result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance.id,
            WorkSession.status == "active",
        )
    )
    active = session_result.scalar_one_or_none()
    if active:
        active.status = "ended"
        active.end_reason = "manual"
        active.ended_at = now
        if active.started_at:
            active.duration_minutes = int(
                (now - _aware(active.started_at)).total_seconds() / 60
            )

    # Sum all session minutes
    total_result = await db.execute(
        select(func.sum(WorkSession.duration_minutes)).where(
            WorkSession.attendance_id == attendance.id,
        )
    )
    total_minutes = int(total_result.scalar() or 0)
    overtime = max(0, total_minutes - STANDARD_MINUTES)
    standard = min(total_minutes, STANDARD_MINUTES)

    attendance.check_out = now
    attendance.duration_minutes = total_minutes
    attendance.standard_minutes = standard
    attendance.overtime_minutes = overtime
    attendance.current_status = "ended"
    attendance.confirmed_at = now

    # Generate timesheet entries
    task_breakdown = payload.get("task_breakdown") or []

    # Find or create this week's timesheet
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    ts_result = await db.execute(
        select(Timesheet).where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start,
        )
    )
    timesheet = ts_result.scalar_one_or_none()
    if not timesheet:
        timesheet = Timesheet(
            id=str(uuid.uuid4()),
            person_id=current_user.person_id,
            week_start_date=week_start,
            week_end_date=week_end,
            status="draft",
            expected_hours=40,
            total_hours=0,
        )
        db.add(timesheet)
        await db.flush()

    # Delete any existing entries for today (safety)
    existing = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.timesheet_id == timesheet.id,
            TimesheetEntry.date == today,
        )
    )
    for e in existing.scalars().all():
        await db.delete(e)

    # Create entries — split standard and overtime
    if task_breakdown:
        for item in task_breakdown:
            task_id = item.get("task_id")
            hours = float(item.get("hours", 0))
            if hours <= 0:
                continue

            project_id = None
            description = item.get("description")

            if task_id:
                from app.models.sql.project import Task
                t_result = await db.execute(
                    select(Task).where(Task.id == task_id)
                )
                task = t_result.scalar_one_or_none()
                if task:
                    project_id = task.project_id
                    if not description:
                        description = task.title

            entry = TimesheetEntry(
                id=str(uuid.uuid4()),
                timesheet_id=timesheet.id,
                date=today,
                project_id=project_id,
                task_id=task_id,
                duration=Decimal(str(hours)),
                description=description or "Work",
                is_billable="yes",
                source="attendance",
                attendance_id=attendance.id,
                is_locked=True,
                is_overtime=False,
            )
            db.add(entry)

        # Add overtime entry
        if overtime > 0:
            entry = TimesheetEntry(
                id=str(uuid.uuid4()),
                timesheet_id=timesheet.id,
                date=today,
                project_id=None,
                task_id=None,
                duration=Decimal(str(round(overtime / 60, 2))),
                description="Overtime",
                is_billable="yes",
                source="attendance",
                attendance_id=attendance.id,
                is_locked=True,
                is_overtime=True,
                overtime_minutes=overtime,
            )
            db.add(entry)
    else:
        # Simple case — 1 entry for the day
        if standard > 0:
            entry = TimesheetEntry(
                id=str(uuid.uuid4()),
                timesheet_id=timesheet.id,
                date=today,
                project_id=None,
                task_id=None,
                duration=Decimal(str(round(standard / 60, 2))),
                description="General work",
                is_billable="yes",
                source="attendance",
                attendance_id=attendance.id,
                is_locked=True,
            )
            db.add(entry)
        if overtime > 0:
            entry = TimesheetEntry(
                id=str(uuid.uuid4()),
                timesheet_id=timesheet.id,
                date=today,
                project_id=None,
                task_id=None,
                duration=Decimal(str(round(overtime / 60, 2))),
                description="Overtime",
                is_billable="yes",
                source="attendance",
                attendance_id=attendance.id,
                is_locked=True,
                is_overtime=True,
                overtime_minutes=overtime,
            )
            db.add(entry)

    # Recompute total
    await db.flush()
    total_hours_result = await db.execute(
        select(func.sum(TimesheetEntry.duration)).where(
            TimesheetEntry.timesheet_id == timesheet.id
        )
    )
    timesheet.total_hours = Decimal(str(total_hours_result.scalar() or 0))

    await db.commit()

    return {
        "total_minutes": total_minutes,
        "standard_minutes": standard,
        "overtime_minutes": overtime,
        "check_out": now.isoformat(),
    }
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.timekeeping.work_session import WorkSession
from app.services.timekeeping import attendance_service as timekeeping

router = APIRouter()


def _serialize_session(session: WorkSession, now) -> dict:
    return {
        "id": str(session.id),
        "started_at": timekeeping.aware(session.started_at).isoformat(),
        "last_activity_at": timekeeping.aware(
            session.last_activity_at
        ).isoformat(),
        "effective_minutes": timekeeping.effective_minutes(session, now),
    }


# ============================================
# SESSION STATE
# ============================================

@router.get("/status")
async def get_session_status(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Return today's attendance and effective worked time.

    ``effective_minutes`` excludes idle gaps; ``elapsed_minutes`` is the raw
    clock time since check-in, and ``idle_minutes`` is the difference.
    """
    attendance = await timekeeping.get_today_attendance(
        db,
        current_user.person_id,
    )

    if not attendance:
        return {
            "has_attendance": False,
            "status": "not_started",
            "session": None,
            "total_minutes": 0,
            "effective_minutes": 0,
            "elapsed_minutes": 0,
            "idle_minutes": 0,
            "standard_minutes": 0,
            "overtime_minutes": 0,
            "last_heartbeat_at": None,
        }

    now = timekeeping.utcnow()
    sessions = await timekeeping.load_day_sessions(db, attendance.id)
    effective = timekeeping.day_effective_minutes(sessions, now)
    elapsed = timekeeping.day_elapsed_minutes(attendance, now)
    idle = max(0, elapsed - effective)

    active_session = next(
        (s for s in sessions if s.status == "active"),
        None,
    )

    status_value = (
        attendance.current_status
        or ("ended" if attendance.check_out else "not_started")
    )

    return {
        "has_attendance": True,
        "attendance_id": str(attendance.id),
        "work_type": attendance.work_type or "office",
        "check_in": (
            timekeeping.aware(attendance.check_in).isoformat()
            if attendance.check_in
            else None
        ),
        "check_out": (
            timekeeping.aware(attendance.check_out).isoformat()
            if attendance.check_out
            else None
        ),
        "status": status_value,
        "session": (
            _serialize_session(active_session, now)
            if active_session
            else None
        ),
        "total_minutes": effective,
        "effective_minutes": effective,
        "elapsed_minutes": elapsed,
        "idle_minutes": idle,
        "standard_minutes": min(effective, timekeeping.STANDARD_MINUTES),
        "overtime_minutes": max(
            0,
            effective - timekeeping.STANDARD_MINUTES,
        ),
        "last_heartbeat_at": (
            timekeeping.aware(attendance.last_heartbeat_at).isoformat()
            if attendance.last_heartbeat_at
            else None
        ),
    }


# ============================================
# START SESSION (called after check-in)
# ============================================

@router.post("/start")
async def start_session(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """Start a new work session for today."""
    attendance = await timekeeping.get_today_attendance(
        db,
        current_user.person_id,
    )
    if not attendance:
        raise HTTPException(status_code=400, detail="Check in first")

    if attendance.check_out:
        raise HTTPException(
            status_code=400,
            detail="Already checked out today",
        )

    now = timekeeping.utcnow()

    for dangling in await timekeeping.active_sessions(db, attendance.id):
        timekeeping.finalize_session(
            dangling,
            timekeeping.idle_end_time(dangling, now),
            "restart",
        )

    session = WorkSession(
        id=str(uuid.uuid4()),
        attendance_id=attendance.id,
        person_id=current_user.person_id,
        started_at=now,
        last_activity_at=now,
        duration_minutes=0,
        status="active",
    )
    db.add(session)

    attendance.current_status = "active"
    attendance.last_heartbeat_at = now
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
    current_user=Depends(get_current_active_user),
):
    """Record activity and accrue the capped heartbeat window."""
    attendance = await timekeeping.get_today_attendance(
        db,
        current_user.person_id,
    )
    if not attendance:
        raise HTTPException(status_code=400, detail="No attendance")

    if attendance.check_out:
        return {"ok": True, "checked_out": True, "effective_minutes": 0}

    now = timekeeping.utcnow()
    sessions = await timekeeping.active_sessions(db, attendance.id)

    session = sessions[0] if sessions else None

    if not session:
        session = WorkSession(
            id=str(uuid.uuid4()),
            attendance_id=attendance.id,
            person_id=current_user.person_id,
            started_at=now,
            last_activity_at=now,
            duration_minutes=0,
            status="active",
        )
        db.add(session)
    else:
        # A duplicate active session should never survive; close extras
        # without granting them the current window twice.
        for duplicate in sessions[1:]:
            timekeeping.finalize_session(
                duplicate,
                timekeeping.idle_end_time(duplicate, now),
                "duplicate",
            )
        timekeeping.accrue(session, now)

    attendance.last_heartbeat_at = now
    attendance.current_status = "active"
    await db.commit()

    return {
        "ok": True,
        "effective_minutes": timekeeping.effective_minutes(session, now),
    }


# ============================================
# PAUSE (user went idle)
# ============================================

@router.post("/pause")
async def pause_session(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """End the active session at last-activity + grace, not at now."""
    attendance = await timekeeping.get_today_attendance(
        db,
        current_user.person_id,
    )
    if not attendance:
        return {"ok": True}

    now = timekeeping.utcnow()

    for session in await timekeeping.active_sessions(db, attendance.id):
        timekeeping.finalize_session(
            session,
            timekeeping.idle_end_time(session, now),
            "idle_timeout",
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
    current_user=Depends(get_current_active_user),
):
    """
    User was away for 30+ minutes. End the day's session.
    Idle time is excluded; the user must log in again to resume.
    """
    attendance = await timekeeping.get_today_attendance(
        db,
        current_user.person_id,
    )
    if not attendance:
        return {"ok": True}

    now = timekeeping.utcnow()

    for session in await timekeeping.active_sessions(db, attendance.id):
        timekeeping.finalize_session(
            session,
            timekeeping.idle_end_time(session, now),
            "auto_ended",
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
    current_user=Depends(get_current_active_user),
):
    """End the day using the shared checkout implementation."""
    result = await timekeeping.checkout_day(
        db,
        person_id=current_user.person_id,
        actor=current_user,
        task_breakdown=payload.get("task_breakdown") or [],
        notes=payload.get("notes"),
    )

    return {
        "total_minutes": result["total_minutes"],
        "standard_minutes": result["standard_minutes"],
        "overtime_minutes": result["overtime_minutes"],
        "elapsed_minutes": result["elapsed_minutes"],
        "idle_minutes": result["idle_minutes"],
        "total_hours": result["total_hours"],
        "check_out": result["check_out"].isoformat(),
    }

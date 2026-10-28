"""Attendance and work-session accounting.

Worked time is accumulated from heartbeat-covered intervals, never from
wall-clock elapsed time. Every accrual is capped, so a long gap (closed
laptop, idle tab, overnight break) contributes at most
``HEARTBEAT_CAP_MINUTES`` to the session.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.projects.project import Task
from app.models.sql.timekeeping.attendance import Attendance
from app.models.sql.timekeeping.timesheet import Timesheet, TimesheetEntry
from app.models.sql.timekeeping.work_session import WorkSession
from app.services.core.audit_service import AuditService

STANDARD_MINUTES = 8 * 60

# A heartbeat is sent every 5 minutes; allow 2 minutes of drift before the
# gap is treated as idle. Anything longer is not paid.
HEARTBEAT_CAP_MINUTES = 7

# When a client reports idle, stop the session shortly after the last
# heartbeat instead of at "now", which would include the idle window.
IDLE_END_GRACE_MINUTES = 2

# Server-side sweep: close sessions with no heartbeat for this long.
AUTO_END_AFTER_MINUTES = 15


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def minutes_between(start: datetime | None, end: datetime | None) -> int:
    start = aware(start)
    end = aware(end)
    if not start or not end or end <= start:
        return 0
    return int((end - start).total_seconds() // 60)


def pending_minutes(session: WorkSession, now: datetime | None = None) -> int:
    """Minutes since the last heartbeat, capped to the heartbeat window."""
    now = now or utcnow()
    anchor = aware(session.last_activity_at) or aware(session.started_at)
    return min(minutes_between(anchor, now), HEARTBEAT_CAP_MINUTES)


def effective_minutes(
    session: WorkSession,
    now: datetime | None = None,
) -> int:
    """Accrued minutes plus the current (capped) heartbeat window."""
    return int(session.duration_minutes or 0) + pending_minutes(session, now)


def accrue(session: WorkSession, now: datetime | None = None) -> int:
    """Fold the current heartbeat window into the session total."""
    now = now or utcnow()
    added = pending_minutes(session, now)
    session.duration_minutes = int(session.duration_minutes or 0) + added
    session.last_activity_at = now
    return added


def finalize_session(
    session: WorkSession,
    end_at: datetime | None = None,
    reason: str = "manual",
) -> int:
    """Close a session, accruing only the capped heartbeat window."""
    end_at = end_at or utcnow()
    added = pending_minutes(session, end_at)
    session.duration_minutes = int(session.duration_minutes or 0) + added
    session.last_activity_at = end_at
    session.ended_at = end_at
    session.status = "ended"
    session.end_reason = reason
    return added


def idle_end_time(
    session: WorkSession,
    now: datetime | None = None,
) -> datetime:
    """The moment a session really stopped: last heartbeat plus grace."""
    now = now or utcnow()
    anchor = aware(session.last_activity_at) or aware(session.started_at) or now
    return min(now, anchor + timedelta(minutes=IDLE_END_GRACE_MINUTES))


async def load_day_sessions(
    db: AsyncSession,
    attendance_id,
) -> list[WorkSession]:
    result = await db.execute(
        select(WorkSession)
        .where(WorkSession.attendance_id == attendance_id)
        .order_by(WorkSession.started_at)
    )
    return list(result.scalars().all())


def day_effective_minutes(
    sessions: list[WorkSession],
    now: datetime | None = None,
) -> int:
    now = now or utcnow()
    total = 0
    for session in sessions:
        if session.status == "active":
            total += effective_minutes(session, now)
        else:
            total += int(session.duration_minutes or 0)
    return total


def day_elapsed_minutes(
    attendance: Attendance,
    now: datetime | None = None,
) -> int:
    now = now or utcnow()
    if attendance.check_out:
        return minutes_between(attendance.check_in, attendance.check_out)
    return minutes_between(attendance.check_in, now)


async def active_sessions(
    db: AsyncSession,
    attendance_id,
) -> list[WorkSession]:
    result = await db.execute(
        select(WorkSession).where(
            WorkSession.attendance_id == attendance_id,
            WorkSession.status == "active",
        )
    )
    return list(result.scalars().all())


async def get_today_attendance(
    db: AsyncSession,
    person_id,
    day: date | None = None,
) -> Attendance | None:
    day = day or date.today()
    result = await db.execute(
        select(Attendance)
        .where(
            Attendance.person_id == person_id,
            Attendance.date == day,
        )
        .order_by(Attendance.created_at)
        .limit(1)
    )
    return result.scalars().first()


def _hours(minutes: int) -> Decimal:
    return Decimal(str(round(minutes / 60, 2)))


def _allocate_breakdown(
    items: list[dict],
    regular_minutes: int,
) -> list[tuple[dict, int]]:
    """Scale user-entered hours so they cover exactly the regular minutes."""
    cleaned: list[tuple[dict, int]] = []
    for item in items:
        try:
            hours = float(item.get("hours") or 0)
        except (TypeError, ValueError):
            hours = 0
        if hours > 0:
            cleaned.append((item, int(round(hours * 60))))

    provided = sum(minutes for _, minutes in cleaned)
    if not cleaned or provided <= 0 or regular_minutes <= 0:
        return []

    allocations: list[tuple[dict, int]] = []
    remaining = regular_minutes

    for index, (item, item_minutes) in enumerate(cleaned):
        if index == len(cleaned) - 1:
            minutes = remaining
        else:
            minutes = int(round(regular_minutes * item_minutes / provided))
            minutes = min(minutes, remaining)
        if minutes <= 0:
            continue
        remaining -= minutes
        allocations.append((item, minutes))

    return allocations


async def checkout_day(
    db: AsyncSession,
    *,
    person_id,
    actor,
    task_breakdown: list[dict] | None = None,
    notes: str | None = None,
    day: date | None = None,
) -> dict:
    """Close the day and write the timesheet from effective minutes.

    This is the single checkout implementation for both the attendance and
    session endpoints, so they can never disagree again.
    """
    day = day or date.today()
    now = utcnow()

    attendance = await get_today_attendance(db, person_id, day)
    if not attendance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No check-in found for today",
        )
    if attendance.check_out:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already checked out today",
        )

    old_values = {
        "check_in": (
            attendance.check_in.isoformat() if attendance.check_in else None
        ),
        "duration_minutes": attendance.duration_minutes,
        "status": attendance.status,
    }

    sessions = await load_day_sessions(db, attendance.id)
    for session in sessions:
        if session.status == "active":
            finalize_session(session, now, "manual")

    total_minutes = sum(int(s.duration_minutes or 0) for s in sessions)
    elapsed_minutes = minutes_between(attendance.check_in, now)
    idle_minutes = max(0, elapsed_minutes - total_minutes)

    standard_minutes = min(total_minutes, STANDARD_MINUTES)
    overtime_minutes = max(0, total_minutes - STANDARD_MINUTES)

    attendance.check_out = now
    attendance.confirmed_at = now
    attendance.duration_minutes = total_minutes
    attendance.standard_minutes = standard_minutes
    attendance.overtime_minutes = overtime_minutes
    attendance.current_status = "ended"
    if notes:
        attendance.checkout_notes = notes

    week_start = day - timedelta(days=day.weekday())
    week_end = week_start + timedelta(days=6)

    ts_result = await db.execute(
        select(Timesheet)
        .where(
            Timesheet.person_id == person_id,
            Timesheet.week_start_date == week_start,
        )
        .order_by(Timesheet.created_at)
        .limit(1)
    )
    timesheet = ts_result.scalars().first()
    if not timesheet:
        timesheet = Timesheet(
            id=str(uuid.uuid4()),
            person_id=person_id,
            week_start_date=week_start,
            week_end_date=week_end,
            status="draft",
            expected_hours=40,
            total_hours=0,
        )
        db.add(timesheet)
        await db.flush()

    # Checkout is repeatable after correcting a session: clear today's
    # generated entries before rewriting them.
    existing_result = await db.execute(
        select(TimesheetEntry).where(
            TimesheetEntry.timesheet_id == timesheet.id,
            TimesheetEntry.date == day,
        )
    )
    for entry in existing_result.scalars().all():
        await db.delete(entry)
    await db.flush()

    created_entries: list[dict] = []
    completed_task_ids: list[str] = []

    breakdown = task_breakdown or []
    allocations = _allocate_breakdown(breakdown, standard_minutes)

    if allocations:
        for item, minutes in allocations:
            task_id = item.get("task_id")
            project_id = None
            description = item.get("description")

            if task_id:
                task_result = await db.execute(
                    select(Task).where(Task.id == task_id)
                )
                task = task_result.scalar_one_or_none()
                if task:
                    project_id = task.project_id
                    description = description or task.title
                    if item.get("completed"):
                        task.status = "done"
                        task.completed_at = now
                        completed_task_ids.append(str(task.id))

            entry = TimesheetEntry(
                id=str(uuid.uuid4()),
                timesheet_id=timesheet.id,
                date=day,
                project_id=project_id,
                task_id=task_id,
                duration=_hours(minutes),
                description=description or "General work",
                is_billable="yes",
                source="attendance",
                attendance_id=attendance.id,
                is_locked=True,
                is_overtime=False,
                overtime_minutes=0,
            )
            db.add(entry)
            created_entries.append(
                {
                    "task_id": str(task_id) if task_id else None,
                    "hours": float(_hours(minutes)),
                    "description": entry.description,
                }
            )
    elif standard_minutes > 0:
        entry = TimesheetEntry(
            id=str(uuid.uuid4()),
            timesheet_id=timesheet.id,
            date=day,
            project_id=None,
            task_id=None,
            duration=_hours(standard_minutes),
            description="General work",
            is_billable="yes",
            source="attendance",
            attendance_id=attendance.id,
            is_locked=True,
            is_overtime=False,
            overtime_minutes=0,
        )
        db.add(entry)
        created_entries.append(
            {
                "task_id": None,
                "hours": float(_hours(standard_minutes)),
                "description": "General work",
            }
        )

    if overtime_minutes > 0:
        entry = TimesheetEntry(
            id=str(uuid.uuid4()),
            timesheet_id=timesheet.id,
            date=day,
            project_id=None,
            task_id=None,
            duration=_hours(overtime_minutes),
            description="Overtime",
            is_billable="yes",
            source="attendance",
            attendance_id=attendance.id,
            is_locked=True,
            is_overtime=True,
            overtime_minutes=overtime_minutes,
        )
        db.add(entry)
        created_entries.append(
            {
                "task_id": None,
                "hours": float(_hours(overtime_minutes)),
                "description": "Overtime",
            }
        )

    attendance.completed_task_ids = completed_task_ids

    await db.flush()

    total_result = await db.execute(
        select(func.sum(TimesheetEntry.duration)).where(
            TimesheetEntry.timesheet_id == timesheet.id
        )
    )
    total_hours = total_result.scalar() or 0
    timesheet.total_hours = Decimal(str(total_hours))

    await AuditService.log(
        db,
        actor=actor,
        action="ATTENDANCE_CHECKED_OUT",
        entity_type="attendance",
        entity_id=attendance.id,
        description=(
            f"Checked out for {day.isoformat()} after "
            f"{total_minutes} effective minutes "
            f"({idle_minutes} idle minutes excluded)"
        ),
        old_values=old_values,
        new_values={
            "check_out": now.isoformat(),
            "duration_minutes": total_minutes,
            "elapsed_minutes": elapsed_minutes,
            "idle_minutes": idle_minutes,
            "status": attendance.status,
            "timesheet_id": str(timesheet.id),
            "timesheet_entries": created_entries,
            "total_hours": float(total_hours),
        },
    )

    await db.commit()

    return {
        "attendance": attendance,
        "timesheet": timesheet,
        "total_minutes": total_minutes,
        "standard_minutes": standard_minutes,
        "overtime_minutes": overtime_minutes,
        "elapsed_minutes": elapsed_minutes,
        "idle_minutes": idle_minutes,
        "check_out": now,
        "total_hours": float(total_hours),
        "completed_task_ids": completed_task_ids,
        "entries": created_entries,
    }

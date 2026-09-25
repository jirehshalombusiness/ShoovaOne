from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.attendance import Attendance
from app.models.sql.project import Task, Project
from app.models.sql.timesheet import Timesheet, TimesheetEntry
from app.models.pydantic.attendance import AttendanceResponse
from app.services.permission_service import PermissionService
from app.services.audit_service import AuditService

router = APIRouter()


# ============================================
# HELPERS
# ============================================

def _to_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Ensure datetime is timezone-aware."""
    if dt is None:
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt


# ============================================
# TODAY — attendance + planned tasks
# ============================================

@router.get("/today")
async def get_today_attendance(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ATTENDANCE_CHECKIN)
    ),
):
    """
    Get today's attendance status and tasks the user should work on.
    """

    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )

    attendance = result.scalar_one_or_none()

    tasks_result = await db.execute(
        select(Task)
        .where(
            Task.assignee_id == current_user.person_id,
            Task.status.notin_(["done", "cancelled"]),
        )
        .order_by(
            Task.due_date.asc().nulls_last(),
            Task.priority.desc(),
        )
        .limit(50)
    )

    tasks = tasks_result.scalars().all()

    project_ids = [
        str(task.project_id)
        for task in tasks
        if task.project_id
    ]

    projects_map = {}

    if project_ids:
        project_result = await db.execute(
            select(Project).where(Project.id.in_(project_ids))
        )

        for project in project_result.scalars().all():
            projects_map[str(project.id)] = project.name

    assigned_tasks = [
        {
            "id": str(task.id),
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
            "due_date": (
                task.due_date.isoformat()
                if task.due_date
                else None
            ),
            "project_id": (
                str(task.project_id)
                if task.project_id
                else None
            ),
            "project_name": (
                projects_map.get(str(task.project_id))
                if task.project_id
                else None
            ),
            "is_personal": task.project_id is None,
        }
        for task in tasks
    ]

    return {
        "date": today.isoformat(),
        "check_in": (
            attendance.check_in.isoformat()
            if attendance and attendance.check_in
            else None
        ),
        "check_out": (
            attendance.check_out.isoformat()
            if attendance and attendance.check_out
            else None
        ),
        "duration_minutes": (
            attendance.duration_minutes
            if attendance
            else None
        ),
        "status": (
            attendance.status
            if attendance
            else "not_checked_in"
        ),
        "planned_task_ids": (
            attendance.planned_task_ids
            if attendance and attendance.planned_task_ids
            else []
        ),
        "adhoc_tasks": (
            attendance.adhoc_tasks
            if attendance and attendance.adhoc_tasks
            else []
        ),
        "assigned_tasks": assigned_tasks,
    }


# ============================================
# CHECK IN
# ============================================

@router.post("/checkin")
async def check_in(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ATTENDANCE_CHECKIN)
    ),
):
    """
    Check in for today with optional planned tasks.

    Body:
    {
        "planned_task_ids": ["uuid1", "uuid2"],
        "adhoc_tasks": [
            {
                "title": "Research competitor X",
                "priority": "medium"
            }
        ],
        "notes": "optional"
    }
    """

    today = date.today()

    existing_result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )

    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Already checked in today",
        )

    planned_task_ids = payload.get("planned_task_ids") or []
    adhoc_tasks = payload.get("adhoc_tasks") or []
    notes = payload.get("notes")

    # Validate planned task IDs belong to the current user.
    if planned_task_ids:
        valid_result = await db.execute(
            select(Task.id).where(
                Task.id.in_(planned_task_ids),
                Task.assignee_id == current_user.person_id,
            )
        )

        valid_ids = [
            str(row[0])
            for row in valid_result.all()
        ]

        planned_task_ids = valid_ids

    # Create ad-hoc personal tasks.
    created_adhoc = []

    for item in adhoc_tasks:
        title = (item.get("title") or "").strip()

        if not title:
            continue

        task = Task(
            id=str(uuid.uuid4()),
            project_id=None,
            title=title,
            description=item.get("description"),
            status="todo",
            priority=item.get("priority", "medium"),
            assignee_id=current_user.person_id,
            reporter_id=current_user.person_id,
            due_date=today,
        )

        db.add(task)

        created_adhoc.append(
            {
                "id": str(task.id),
                "title": task.title,
                "priority": task.priority,
            }
        )

        planned_task_ids.append(str(task.id))

    # Create attendance record.
    now = datetime.now(timezone.utc)

    attendance = Attendance(
        id=str(uuid.uuid4()),
        person_id=current_user.person_id,
        date=today,
        check_in=now,
        status="present",
        notes=notes,
        planned_task_ids=planned_task_ids,
        adhoc_tasks=created_adhoc,
    )

    db.add(attendance)

    # Flush first so the audit record references
    # the newly-created attendance ID.
    await db.flush()

    await AuditService.log(
        db,
        actor=current_user,
        action="ATTENDANCE_CHECKED_IN",
        entity_type="attendance",
        entity_id=attendance.id,
        description=(
            f"Checked in for {today.isoformat()}"
        ),
        new_values={
            "date": today.isoformat(),
            "check_in": now.isoformat(),
            "status": attendance.status,
            "planned_task_ids": planned_task_ids,
            "adhoc_tasks": created_adhoc,
        },
    )

    # Attendance and audit are committed together.
    await db.commit()

    await db.refresh(attendance)

    return {
        "id": str(attendance.id),
        "check_in": attendance.check_in.isoformat(),
        "planned_task_ids": attendance.planned_task_ids,
        "adhoc_tasks": attendance.adhoc_tasks,
    }


# ============================================
# CHECK OUT — generates timesheet entries
# ============================================

@router.post("/checkout")
async def check_out(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ATTENDANCE_CHECKIN)
    ),
):
    """
    Check out for today.

    Creates timesheet entries for hours worked
    and marks completed tasks as done.

    Body:
    {
        "task_breakdown": [
            {
                "task_id": "uuid",
                "hours": 4.0,
                "completed": true
            },
            {
                "task_id": "uuid",
                "hours": 2.0,
                "completed": false
            },
            {
                "task_id": null,
                "hours": 2.0,
                "description": "General work"
            }
        ],
        "notes": "optional checkout notes"
    }
    """

    today = date.today()

    result = await db.execute(
        select(Attendance).where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
    )

    attendance = result.scalar_one_or_none()

    if not attendance:
        raise HTTPException(
            status_code=404,
            detail="No check-in found for today",
        )

    if attendance.check_out:
        raise HTTPException(
            status_code=400,
            detail="Already checked out today",
        )

    now = datetime.now(timezone.utc)

    old_values = {
        "check_in": (
            attendance.check_in.isoformat()
            if attendance.check_in
            else None
        ),
        "check_out": None,
        "duration_minutes": attendance.duration_minutes,
        "status": attendance.status,
    }

    attendance.check_out = now
    attendance.confirmed_at = now

    check_in = _to_aware(attendance.check_in)

    total_minutes = int(
        (now - check_in).total_seconds() / 60
    )

    attendance.duration_minutes = total_minutes

    checkout_notes = payload.get("notes")

    if checkout_notes:
        attendance.checkout_notes = checkout_notes

    task_breakdown = payload.get("task_breakdown") or []

    # Validate breakdown hours.
    if task_breakdown:
        breakdown_minutes = sum(
            int(float(item.get("hours", 0)) * 60)
            for item in task_breakdown
        )

        if abs(breakdown_minutes - total_minutes) > 5:
            diff = total_minutes - breakdown_minutes

            last = task_breakdown[-1]
            last_hours = float(
                last.get("hours", 0)
            )

            last["hours"] = max(
                0.1,
                last_hours + diff / 60,
            )

    # Find or create this week's timesheet.
    week_start = (
        today - timedelta(days=today.weekday())
    )

    week_end = week_start + timedelta(days=6)

    ts_result = await db.execute(
        select(Timesheet).where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start,
        )
    )

    timesheet = ts_result.scalar_one_or_none()

    timesheet_created = False

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

        timesheet_created = True

    completed_task_ids = []
    created_timesheet_entries = []

    if task_breakdown:
        for item in task_breakdown:
            task_id = item.get("task_id")
            hours = float(item.get("hours", 0))

            if hours <= 0:
                continue

            project_id = None
            description = item.get("description")

            if task_id:
                task_result = await db.execute(select(Task).where(Task.id == task_id))
                task = task_result.scalar_one_or_none()
                if task:
                    project_id = task.project_id
                    description = description or task.title
                    if item.get("completed"):
                        task.status = "done"
                        task.completed_at = now
                        completed_task_ids.append(str(task.id))

            ts_entry = TimesheetEntry(
                id=str(uuid.uuid4()), timesheet_id=timesheet.id, date=today,
                project_id=project_id, task_id=task_id, duration=Decimal(str(hours)),
                description=description or "General work", is_billable="yes",
                source="attendance", attendance_id=attendance.id, is_locked=True,
                is_overtime=False, overtime_minutes=0,
            )
            db.add(ts_entry)
            await db.flush()
            created_timesheet_entries.append({
                "id": str(ts_entry.id), "task_id": str(task_id) if task_id else None,
                "hours": hours, "description": description or "General work",
            })

    # Overtime entry, if any.
    if overtime > 0:
        ts_entry = TimesheetEntry(
            id=str(uuid.uuid4()), timesheet_id=timesheet.id, date=today,
            project_id=None, task_id=None, duration=Decimal(str(round(overtime / 60, 2))),
            description="Overtime", is_billable="yes", source="attendance",
            attendance_id=attendance.id, is_locked=True, is_overtime=True,
            overtime_minutes=overtime,
        )
        db.add(ts_entry)
        await db.flush()
        created_timesheet_entries.append({
            "id": str(ts_entry.id), "task_id": None,
            "hours": round(overtime / 60, 2), "description": "Overtime",
        })
    elif not task_breakdown:
        hours = total_minutes / 60
        if hours > 0:
            ts_entry = TimesheetEntry(
                id=str(uuid.uuid4()), timesheet_id=timesheet.id, date=today,
                project_id=None, task_id=None, duration=Decimal(str(round(hours, 2))),
                description="General work", is_billable="yes", source="attendance",
                attendance_id=attendance.id, is_locked=True, is_overtime=False,
                overtime_minutes=0,
            )
            db.add(ts_entry)
            await db.flush()
            created_timesheet_entries.append({
                "id": str(ts_entry.id), "task_id": None,
                "hours": round(hours, 2), "description": "General work",
            })

    attendance.completed_task_ids = (
        completed_task_ids
    )

    # Recalculate total hours.
    await db.flush()

    total_result = await db.execute(
        select(
            func.sum(TimesheetEntry.duration)
        ).where(
            TimesheetEntry.timesheet_id
            == timesheet.id
        )
    )

    total_hours = (
        total_result.scalar() or 0
    )

    timesheet.total_hours = Decimal(
        str(total_hours)
    )

    new_values = {
        "check_in": (
            attendance.check_in.isoformat()
            if attendance.check_in
            else None
        ),
        "check_out": now.isoformat(),
        "duration_minutes": total_minutes,
        "status": attendance.status,
        "checkout_notes": checkout_notes,
        "completed_task_ids": completed_task_ids,
        "timesheet_id": str(timesheet.id),
        "timesheet_created": timesheet_created,
        "timesheet_entries": created_timesheet_entries,
        "total_hours": float(total_hours),
    }

    await AuditService.log(
        db,
        actor=current_user,
        action="ATTENDANCE_CHECKED_OUT",
        entity_type="attendance",
        entity_id=attendance.id,
        description=(
            f"Checked out for {today.isoformat()} "
            f"after {total_minutes} minutes"
        ),
        old_values=old_values,
        new_values=new_values,
    )

    # Commit attendance, timesheet entries,
    # tasks and audit together.
    await db.commit()

    return {
        "id": str(attendance.id),
        "check_in": attendance.check_in.isoformat(),
        "check_out": attendance.check_out.isoformat(),
        "duration_minutes": attendance.duration_minutes,
        "total_hours": float(total_hours),
        "completed_task_ids": completed_task_ids,
        "timesheet_id": str(timesheet.id),
    }


# ============================================
# HISTORY
# ============================================

@router.get(
    "/",
    response_model=List[AttendanceResponse],
)
async def get_attendance(
    person_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(
        50,
        ge=1,
        le=200,
    ),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(
        require_permission(Permissions.ATTENDANCE_VIEW)
    ),
):
    """Get attendance records."""

    # Users with attendance.view_any may view
    # another person's attendance.
    can_view_any = await PermissionService.has_permission(
        db,
        current_user.id,
        Permissions.ATTENDANCE_VIEW_ANY,
    )

    query = select(Attendance)

    if person_id:

        if not can_view_any:
            if person_id != current_user.person_id:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You do not have permission "
                        "to view another person's attendance"
                    ),
                )

        query = query.where(
            Attendance.person_id == person_id
        )

    elif not can_view_any:

        query = query.where(
            Attendance.person_id
            == current_user.person_id
        )

    if start_date:
        query = query.where(
            Attendance.date >= start_date
        )

    if end_date:
        query = query.where(
            Attendance.date <= end_date
        )

    query = (
        query
        .offset(skip)
        .limit(limit)
        .order_by(Attendance.date.desc())
    )

    result = await db.execute(query)

    return result.scalars().all()
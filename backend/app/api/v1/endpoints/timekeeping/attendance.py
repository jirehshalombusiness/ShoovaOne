from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date, datetime, timezone
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.timekeeping.attendance import Attendance
from app.models.sql.timekeeping.work_session import WorkSession
from app.models.sql.projects.project import Task, Project
from app.models.pydantic.timekeeping.attendance import AttendanceResponse
from app.services.core.permission_service import PermissionService
from app.services.core.audit_service import AuditService
from app.services.timekeeping import attendance_service as timekeeping

router = APIRouter()


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
        select(Attendance)
        .where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
        .order_by(Attendance.created_at)
        .limit(1)
    )

    attendance = result.scalars().first()

    effective_minutes = 0
    elapsed_minutes = 0
    session_active = False

    if attendance:
        now = timekeeping.utcnow()
        sessions = await timekeeping.load_day_sessions(
            db,
            attendance.id,
        )
        effective_minutes = timekeeping.day_effective_minutes(
            sessions,
            now,
        )
        elapsed_minutes = timekeeping.day_elapsed_minutes(
            attendance,
            now,
        )
        session_active = any(
            s.status == "active" for s in sessions
        )

    idle_minutes = max(0, elapsed_minutes - effective_minutes)
    live_duration = (
        attendance.duration_minutes
        if attendance and attendance.check_out
        else effective_minutes
        if attendance
        else None
    )

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
        "duration_minutes": live_duration,
        "effective_minutes": effective_minutes,
        "elapsed_minutes": elapsed_minutes,
        "idle_minutes": idle_minutes,
        "session_active": session_active,
        "status": (
            attendance.status
            if attendance
            else "not_checked_in"
        ),
        "current_status": (
            attendance.current_status
            if attendance
            else "not_started"
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
        select(Attendance)
        .where(
            Attendance.person_id == current_user.person_id,
            Attendance.date == today,
        )
        .limit(1)
    )

    existing = existing_result.scalars().first()

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
    work_type = payload.get("work_type") or "office"

    attendance = Attendance(
        id=str(uuid.uuid4()),
        person_id=current_user.person_id,
        date=today,
        check_in=now,
        status="present",
        current_status="active",
        last_heartbeat_at=now,
        work_type=work_type,
        notes=notes,
        planned_task_ids=planned_task_ids,
        adhoc_tasks=created_adhoc,
    )

    db.add(attendance)

    # Flush first so the session and audit record can reference
    # the newly-created attendance ID.
    await db.flush()

    # Checking in starts the first work session. Effective time is
    # accrued from heartbeats, never from the clock.
    db.add(
        WorkSession(
            id=str(uuid.uuid4()),
            attendance_id=attendance.id,
            person_id=current_user.person_id,
            started_at=now,
            last_activity_at=now,
            duration_minutes=0,
            status="active",
        )
    )

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

    result = await timekeeping.checkout_day(
        db,
        person_id=current_user.person_id,
        actor=current_user,
        task_breakdown=payload.get("task_breakdown") or [],
        notes=payload.get("notes"),
    )

    attendance = result["attendance"]

    return {
        "id": str(attendance.id),
        "check_in": attendance.check_in.isoformat(),
        "check_out": attendance.check_out.isoformat(),
        "duration_minutes": result["total_minutes"],
        "total_hours": result["total_hours"],
        "completed_task_ids": result["completed_task_ids"],
        "timesheet_id": str(result["timesheet"].id),
        "elapsed_minutes": result["elapsed_minutes"],
        "idle_minutes": result["idle_minutes"],
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
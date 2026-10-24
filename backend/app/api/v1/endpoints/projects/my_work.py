from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select
from typing import Optional
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.core.user import Person
from app.models.sql.hr.approval import ApprovalRequest
from app.models.sql.meetings.meeting import Meeting, MeetingAttendee
from app.models.sql.projects.project import Task, Project
from app.models.sql.timekeeping.timesheet import Timesheet, TimesheetEntry

router = APIRouter()


@router.get("/summary")
async def get_my_work_summary(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """
    Aggregated summary used by My Work and the personal dashboard.
    """
    person_id = current_user.person_id

    # 1. Count open tasks assigned to me
    tasks_result = await db.execute(
        select(func.count(Task.id))
        .where(
            Task.assignee_id == person_id,
            Task.status.notin_(["done", "cancelled"]),
        )
    )
    open_tasks = tasks_result.scalar() or 0

    # 2. Tasks due today
    today = date.today()
    due_today_result = await db.execute(
        select(func.count(Task.id))
        .where(
            Task.assignee_id == person_id,
            Task.status.notin_(["done", "cancelled"]),
            func.date(Task.due_date) == today,
        )
    )
    tasks_due_today = due_today_result.scalar() or 0

    # 3. Overdue tasks
    overdue_result = await db.execute(
        select(func.count(Task.id))
        .where(
            Task.assignee_id == person_id,
            Task.status.notin_(["done", "cancelled"]),
            Task.due_date < today,
        )
    )
    overdue_tasks = overdue_result.scalar() or 0

    # 4. Timesheet hours this week
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    ts_result = await db.execute(
        select(Timesheet)
        .where(
            Timesheet.person_id == person_id,
            Timesheet.week_start_date == week_start,
        )
    )
    timesheet = ts_result.scalar_one_or_none()

    timesheet_hours = float(timesheet.total_hours) if timesheet else 0
    timesheet_expected = float(timesheet.expected_hours) if timesheet else 40
    timesheet_status = timesheet.status if timesheet else "not_started"

    # 5. Approvals waiting on my decision
    approvals_result = await db.execute(
        select(func.count(ApprovalRequest.id)).where(
            ApprovalRequest.assigned_to_id == person_id,
            ApprovalRequest.status == "pending",
        )
    )
    pending_approvals = approvals_result.scalar() or 0

    # 6. Meetings today where I'm organizer or attendee
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    my_meeting_ids = select(MeetingAttendee.meeting_id).where(
        MeetingAttendee.person_id == person_id
    )
    meetings_result = await db.execute(
        select(func.count(Meeting.id)).where(
            Meeting.status == "scheduled",
            Meeting.starts_at >= day_start,
            Meeting.starts_at < day_end,
            or_(
                Meeting.organizer_id == person_id,
                Meeting.id.in_(my_meeting_ids),
            ),
        )
    )
    meetings_today = meetings_result.scalar() or 0

    return {
        "open_tasks": open_tasks,
        "tasks_due_today": tasks_due_today,
        "overdue_tasks": overdue_tasks,
        "timesheet_hours": timesheet_hours,
        "timesheet_expected": timesheet_expected,
        "timesheet_status": timesheet_status,
        "timesheet_week_start": week_start.isoformat(),
        "timesheet_week_end": week_end.isoformat(),
        "pending_approvals": pending_approvals,
        "meetings_today": meetings_today,
    }


@router.get("/tasks")
async def get_my_tasks(
    filter: Optional[str] = None,  # "today", "overdue", "upcoming", "all"
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get tasks assigned to me."""
    person_id = current_user.person_id
    today = date.today()

    query = select(Task).where(Task.assignee_id == person_id)

    if status:
        query = query.where(Task.status == status)
    else:
        query = query.where(Task.status.notin_(["done", "cancelled"]))

    if filter == "today":
        query = query.where(func.date(Task.due_date) == today)
    elif filter == "overdue":
        query = query.where(Task.due_date < today)
    elif filter == "upcoming":
        query = query.where(
            Task.due_date > today,
            Task.due_date <= today + timedelta(days=7),
        )

    query = query.order_by(
        Task.due_date.asc().nulls_last(),
        Task.priority.desc(),
    ).limit(100)

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "project_id": str(t.project_id) if t.project_id else None,
            "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]


@router.get("/projects")
async def get_my_projects(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get projects where I'm a member."""
    from app.models.sql.projects.project import ProjectMember

    # Find all project IDs where I'm a member
    member_result = await db.execute(
        select(ProjectMember.project_id).where(
            ProjectMember.person_id == current_user.person_id
        )
    )
    project_ids = [r[0] for r in member_result.all()]

    if not project_ids:
        return []

    # Get projects with those IDs, plus counts
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.manager))
        .where(Project.id.in_(project_ids))
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()

    # Build response with my role + counts
    responses = []
    for p in projects:
        # Get my role in this project
        role_result = await db.execute(
            select(ProjectMember.role).where(
                ProjectMember.project_id == p.id,
                ProjectMember.person_id == current_user.person_id,
            )
        )
        my_role = role_result.scalar_one_or_none() or "member"

        # Task counts (assigned to me)
        from app.models.sql.projects.project import Task
        my_tasks_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == p.id,
                Task.assignee_id == current_user.person_id,
                Task.status.notin_(["done", "cancelled"]),
            )
        )
        my_open_tasks = my_tasks_result.scalar() or 0

        total_tasks_result = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == p.id)
        )
        total_tasks = total_tasks_result.scalar() or 0

        completed_result = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == p.id, Task.status == "done"
            )
        )
        completed_tasks = completed_result.scalar() or 0

        responses.append({
            "id": str(p.id),
            "name": p.name,
            "code": p.code,
            "description": p.description,
            "status": p.status,
            "priority": p.priority,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "progress": p.progress or 0,
            "manager_id": str(p.manager_id) if p.manager_id else None,
            "manager_first_name": p.manager.first_name if p.manager else None,
            "manager_last_name": p.manager.last_name if p.manager else None,
            "manager_image_url": p.manager.profile_image_url if p.manager else None,
            "my_role": my_role,
            "my_open_tasks": my_open_tasks,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
        })

    return responses

@router.get("/meetings")
async def get_my_meetings(
    window: str = Query("upcoming", description="upcoming / today / all"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get meetings where I'm the organizer or an attendee."""
    person_id = current_user.person_id
    now = datetime.now(timezone.utc)

    my_meeting_ids = select(MeetingAttendee.meeting_id).where(
        MeetingAttendee.person_id == person_id
    )

    query = (
        select(Meeting)
        .options(selectinload(Meeting.attendees))
        .where(
            or_(
                Meeting.organizer_id == person_id,
                Meeting.id.in_(my_meeting_ids),
            )
        )
    )

    if window == "today":
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(
            Meeting.status == "scheduled",
            Meeting.starts_at >= day_start,
            Meeting.starts_at < day_start + timedelta(days=1),
        ).order_by(Meeting.starts_at)
    elif window == "all":
        query = query.order_by(Meeting.starts_at.desc())
    else:
        query = query.where(
            Meeting.status == "scheduled",
            Meeting.starts_at >= now,
        ).order_by(Meeting.starts_at)

    query = query.limit(limit)
    result = await db.execute(query)
    meetings = result.scalars().all()

    responses = []
    for meeting in meetings:
        my_response = next(
            (
                attendee.response
                for attendee in meeting.attendees
                if attendee.person_id == person_id
            ),
            None,
        )
        responses.append(
            {
                "id": str(meeting.id),
                "title": meeting.title,
                "description": meeting.description,
                "starts_at": meeting.starts_at.isoformat() if meeting.starts_at else None,
                "ends_at": meeting.ends_at.isoformat() if meeting.ends_at else None,
                "duration_minutes": meeting.duration_minutes,
                "location_type": meeting.location_type,
                "location": meeting.location,
                "meeting_url": meeting.meeting_url,
                "status": meeting.status,
                "attendee_count": len(meeting.attendees),
                "my_response": my_response,
                "organizer_name": (
                    f"{meeting.organizer.first_name} {meeting.organizer.last_name}".strip()
                    if meeting.organizer
                    else None
                ),
            }
        )

    return responses

@router.get("/activity")
async def get_my_activity(
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get recent activity by me."""
    from app.models.sql.core.audit_log import AuditLog

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.actor_person_id == current_user.person_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": str(log.entity_id),
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "metadata": log.metadata_,
        }
        for log in logs
    ]

@router.get("/timesheet")
async def get_my_current_timesheet(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """Get my timesheet for the current week."""
    from datetime import date, timedelta
    from app.models.sql.timekeeping.timesheet import Timesheet, TimesheetEntry

    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    result = await db.execute(
        select(Timesheet).where(
            Timesheet.person_id == current_user.person_id,
            Timesheet.week_start_date == week_start,
        )
    )
    timesheet = result.scalar_one_or_none()

    if not timesheet:
        return {
            "week_start_date": week_start.isoformat(),
            "week_end_date": week_end.isoformat(),
            "total_hours": 0,
            "expected_hours": 40,
            "status": "not_started",
            "entries": [],
        }

    # Get entries
    entries_result = await db.execute(
        select(TimesheetEntry)
        .where(TimesheetEntry.timesheet_id == timesheet.id)
        .order_by(TimesheetEntry.date.desc())
    )
    entries = entries_result.scalars().all()

    return {
        "id": str(timesheet.id),
        "week_start_date": timesheet.week_start_date.isoformat(),
        "week_end_date": timesheet.week_end_date.isoformat(),
        "total_hours": float(timesheet.total_hours or 0),
        "expected_hours": float(timesheet.expected_hours or 40),
        "status": timesheet.status,
        "entries": [
            {
                "id": str(e.id),
                "date": e.date.isoformat(),
                "duration": float(e.duration or 0),
                "description": e.description,
                "project_id": str(e.project_id) if e.project_id else None,
            }
            for e in entries
        ],
    }
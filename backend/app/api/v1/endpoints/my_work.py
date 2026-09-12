from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from typing import List, Optional
from datetime import date, datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.user import Person
from app.models.sql.project import Task, Project
from app.models.sql.timesheet import Timesheet, TimesheetEntry

router = APIRouter()


@router.get("/summary")
async def get_my_work_summary(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_user),
):
    """
    Aggregated summary for the My Work page.
    Returns:
    - tasks_count
    - meetings_count (placeholder for now)
    - timesheet_hours_this_week
    - pending_approvals_count
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

    return {
        "open_tasks": open_tasks,
        "tasks_due_today": tasks_due_today,
        "overdue_tasks": overdue_tasks,
        "timesheet_hours": timesheet_hours,
        "timesheet_expected": timesheet_expected,
        "timesheet_status": timesheet_status,
        "timesheet_week_start": week_start.isoformat(),
        "timesheet_week_end": week_end.isoformat(),
        "pending_approvals": 0,  # TODO
        "meetings_today": 0,  # TODO
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
    """Get projects where I'm the manager or assigned to a task."""
    person_id = current_user.person_id

    # Projects I manage
    managed_query = select(Project).where(
        or_(
            Project.manager_id == person_id,
            Project.id.in_(
                select(Task.project_id).where(
                    Task.assignee_id == person_id,
                    Task.project_id.isnot(None),
                )
            ),
        )
    ).limit(50)

    result = await db.execute(managed_query)
    projects = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "name": p.name,
            "code": p.code,
            "status": p.status,
            "priority": p.priority,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "is_manager": str(p.manager_id) == str(person_id),
        }
        for p in projects
    ]
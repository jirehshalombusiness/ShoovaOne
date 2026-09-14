from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.project import Task
from app.models.pydantic.task import TaskResponse


router = APIRouter()


# ============================================
# LIST ALL TASKS (across all projects + personal)
# ============================================

@router.get("/", response_model=List[TaskResponse])
async def list_all_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_VIEW)),
):
    """List all tasks (for admin/global view)."""
    query = (
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.project))
    )

    if status_filter:
        query = query.where(Task.status == status_filter)
    if project_id:
        query = query.where(Task.project_id == project_id)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)

    query = query.order_by(Task.created_at.desc()).limit(limit)
    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        TaskResponse(
            id=str(t.id),
            project_id=str(t.project_id) if t.project_id else None,
            title=t.title,
            description=t.description,
            status=t.status,
            priority=t.priority,
            assignee_id=str(t.assignee_id) if t.assignee_id else None,
            assignee_first_name=t.assignee.first_name if t.assignee else None,
            assignee_last_name=t.assignee.last_name if t.assignee else None,
            assignee_image_url=t.assignee.profile_image_url if t.assignee else None,
            reporter_id=str(t.reporter_id) if t.reporter_id else None,
            due_date=t.due_date,
            start_date=t.start_date,
            completed_at=t.completed_at,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else None,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tasks
    ]


# ============================================
# GET SINGLE TASK
# ============================================

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_VIEW)),
):
    """Get a single task by ID."""
    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.project))
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id) if task.project_id else None,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee_id=str(task.assignee_id) if task.assignee_id else None,
        assignee_first_name=task.assignee.first_name if task.assignee else None,
        assignee_last_name=task.assignee.last_name if task.assignee else None,
        assignee_image_url=task.assignee.profile_image_url if task.assignee else None,
        reporter_id=str(task.reporter_id) if task.reporter_id else None,
        due_date=task.due_date,
        start_date=task.start_date,
        completed_at=task.completed_at,
        estimated_hours=float(task.estimated_hours) if task.estimated_hours else None,
        actual_hours=float(task.actual_hours) if task.actual_hours else None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# ============================================
# UPDATE SINGLE TASK
# ============================================

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_EDIT)),
):
    """Update a task (standalone or project task)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    allowed = ["title", "description", "status", "priority", "due_date", "start_date", "assignee_id"]
    for key in allowed:
        if key in payload and payload[key] is not None:
            setattr(task, key, payload[key])

    if payload.get("status") == "done" and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc)

    await db.commit()

    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assignee), selectinload(Task.project))
        .where(Task.id == task_id)
    )
    task = result.scalar_one()

    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id) if task.project_id else None,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assignee_id=str(task.assignee_id) if task.assignee_id else None,
        assignee_first_name=task.assignee.first_name if task.assignee else None,
        assignee_last_name=task.assignee.last_name if task.assignee else None,
        assignee_image_url=task.assignee.profile_image_url if task.assignee else None,
        reporter_id=str(task.reporter_id) if task.reporter_id else None,
        due_date=task.due_date,
        start_date=task.start_date,
        completed_at=task.completed_at,
        estimated_hours=float(task.estimated_hours) if task.estimated_hours else None,
        actual_hours=float(task.actual_hours) if task.actual_hours else None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


# ============================================
# DELETE SINGLE TASK
# ============================================

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_DELETE)),
):
    """Delete a task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
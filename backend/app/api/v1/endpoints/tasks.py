from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.project import Task, Project
from app.models.pydantic.task import TaskResponse

router = APIRouter()


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


@router.put("/{task_id}", response_model=TaskResponse)
async def update_standalone_task(
    task_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_EDIT)),
):
    """Update a standalone or project task."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for key in ["title", "description", "status", "priority", "due_date", "start_date", "assignee_id"]:
        if key in payload:
            setattr(task, key, payload[key])

    # If status changes to done, set completed_at
    if payload.get("status") == "done" and not task.completed_at:
        from datetime import datetime, timezone
        task.completed_at = datetime.now(timezone.utc)

    await db.commit()

    # Reload with relationships
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


@router.delete("/{task_id}", status_code=204)
async def delete_standalone_task(
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
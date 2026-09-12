from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List, Optional
from datetime import date
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.project import Task, Project
from app.models.sql.user import Person


router = APIRouter()


@router.get("/")
async def list_all_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[str] = None,
    assignee_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.TASKS_VIEW)),
):
    """List all tasks (across projects)."""
    query = select(Task)

    if status_filter:
        query = query.where(Task.status == status_filter)
    if project_id:
        query = query.where(Task.project_id == project_id)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)

    query = query.order_by(Task.created_at.desc()).limit(200)
    result = await db.execute(query)
    tasks = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "project_id": str(t.project_id) if t.project_id else None,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "priority": t.priority,
            "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]
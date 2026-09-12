from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import Person


router = APIRouter()


@router.get("/")
async def list_hr_people(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.HR_VIEW_SENSITIVE)),
):
    """
    Placeholder HR endpoint — returns basic count.
    Real HR endpoints (employment, compensation, leave) will be added later.
    """
    result = await db.execute(
        select(func.count(Person.id)).where(Person.deleted_at.is_(None))
    )
    total = result.scalar() or 0

    return {
        "total_people": total,
        "message": "HR module skeleton — full features coming soon",
    }
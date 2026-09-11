from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import Person
from app.models.pydantic.person import PersonResponse, PersonCreate, PersonUpdate

router = APIRouter()


@router.get("/", response_model=List[PersonResponse])
async def get_people(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """
    Get list of people.
    Requires: people.view permission
    """
    query = select(Person).where(Person.deleted_at.is_(None))

    if search:
        query = query.where(
            or_(
                Person.first_name.ilike(f"%{search}%"),
                Person.last_name.ilike(f"%{search}%"),
                Person.email.ilike(f"%{search}%"),
            )
        )

    if type:
        query = query.where(Person.type == type)
    
    if status:
        query = query.where(Person.status == status)

    query = query.offset(skip).limit(limit).order_by(Person.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
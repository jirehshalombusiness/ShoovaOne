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
    """Get list of people. Requires: people.view permission"""
    try:
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
        people = result.scalars().all()
        
        # Explicitly convert to response objects with string IDs
        return [
            PersonResponse(
                id=str(person.id),
                first_name=person.first_name,
                last_name=person.last_name,
                email=person.email,
                phone=person.phone,
                date_of_birth=person.date_of_birth,
                gender=person.gender,
                type=person.type,
                status=getattr(person, 'status', 'active'),
                profile_image_url=person.profile_image_url,
                address=person.address,
                city=person.city,
                state=person.state,
                country=person.country,
                postal_code=person.postal_code,
                emergency_contact_name=person.emergency_contact_name,
                emergency_contact_phone=person.emergency_contact_phone,
                emergency_contact_relationship=person.emergency_contact_relationship,
                bio=person.bio,
                skills=person.skills,
                created_at=person.created_at,
                updated_at=person.updated_at,
            )
            for person in people
        ]
    except Exception as e:
        print(f"❌ Error getting people: {e}")
        raise HTTPException(status_code=500, detail=str(e))
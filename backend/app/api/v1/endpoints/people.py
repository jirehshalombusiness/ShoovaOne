from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

from app.core.database import get_db
from app.core.security import require_permission, Permissions, get_current_active_user
from app.models.sql.user import Person
from app.models.pydantic.person import PersonResponse, PersonCreate, PersonUpdate

# Create the router
router = APIRouter()


@router.get("/", response_model=List[PersonResponse])
async def get_people(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
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

    query = query.offset(skip).limit(limit).order_by(Person.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_VIEW)),
):
    """
    Get person by ID.
    Requires: people.view permission
    """
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None)
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.post("/", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    person_data: PersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_CREATE)),
):
    """
    Create a new person.
    Requires: people.create permission
    """
    normalized_email = str(person_data.email).strip().lower() if person_data.email else None

    # Check if email already exists, ignoring case and surrounding whitespace.
    if normalized_email:
        result = await db.execute(
            select(Person).where(
                func.lower(Person.email) == normalized_email,
                Person.deleted_at.is_(None)
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
    
    # Generate ID
    import uuid
    person_values = person_data.model_dump()
    person_values["email"] = normalized_email
    person = Person(id=str(uuid.uuid4()), **person_values)
    db.add(person)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="A person with this email already exists")
    await db.refresh(person)
    return person


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: str,
    person_data: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_EDIT)),
):
    """
    Update a person.
    Requires: people.edit permission
    """
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None)
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    for key, value in person_data.model_dump(exclude_unset=True).items():
        setattr(person, key, value)
    
    await db.commit()
    await db.refresh(person)
    return person


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.PEOPLE_DELETE)),
):
    """
    Delete a person (soft delete).
    Requires: people.delete permission
    """
    result = await db.execute(
        select(Person).where(
            Person.id == person_id,
            Person.deleted_at.is_(None)
        )
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    
    from sqlalchemy.sql import func
    person.deleted_at = func.now()
    await db.commit()
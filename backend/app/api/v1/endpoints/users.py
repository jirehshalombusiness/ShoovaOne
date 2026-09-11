from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import hashlib
import uuid

from app.core.database import get_db
from app.core.security import require_permission, Permissions
from app.models.sql.user import User, Person
from app.models.sql.role import Role
from app.models.pydantic.user import (
    ManagedUserCreate,
    ManagedUserUpdate,
    ManagedUserResponse,
)

router = APIRouter()


@router.get("/", response_model=List[ManagedUserResponse])
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.USERS_MANAGE)),
):
    """Get all users. Requires users.manage permission."""
    result = await db.execute(
        select(User, Person).join(Person, User.person_id == Person.id)
    )
    rows = result.all()
    
    users = []
    for user, person in rows:
        users.append(ManagedUserResponse(
            id=str(user.id),
            person_id=str(user.person_id),
            email=user.email,
            first_name=person.first_name,
            last_name=person.last_name,
            is_active=user.is_active,
            roles=[],
            last_login_at=user.last_login_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ))
    return users


@router.post("/", response_model=ManagedUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: ManagedUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.USERS_MANAGE)),
):
    """Create a new user. Requires users.manage permission."""
    existing = await db.execute(select(User).where(User.email == user_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    person = Person(
        id=str(uuid.uuid4()),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        type="staff",
    )
    db.add(person)
    await db.flush()
    
    password_hash = hashlib.sha256(user_data.password.encode()).hexdigest()
    user = User(
        id=str(uuid.uuid4()),
        person_id=person.id,
        email=user_data.email,
        password_hash=password_hash,
        is_active=user_data.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return ManagedUserResponse(
        id=str(user.id),
        person_id=str(user.person_id),
        email=user.email,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=user.is_active,
        roles=user_data.roles or [],
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.put("/{user_id}", response_model=ManagedUserResponse)
async def update_user(
    user_id: str,
    user_data: ManagedUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.USERS_MANAGE)),
):
    """Update a user. Requires users.manage permission."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.execute(select(Person).where(Person.id == user.person_id))
    person = result.scalar_one()
    
    if user_data.email is not None:
        user.email = user_data.email
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.password:
        user.password_hash = hashlib.sha256(user_data.password.encode()).hexdigest()
    if user_data.first_name is not None:
        person.first_name = user_data.first_name
    if user_data.last_name is not None:
        person.last_name = user_data.last_name
    
    await db.commit()
    await db.refresh(user)
    
    return ManagedUserResponse(
        id=str(user.id),
        person_id=str(user.person_id),
        email=user.email,
        first_name=person.first_name,
        last_name=person.last_name,
        is_active=user.is_active,
        roles=user_data.roles or [],
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_permission(Permissions.USERS_MANAGE)),
):
    """Delete a user. Requires users.manage permission."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.delete(user)
    await db.commit()
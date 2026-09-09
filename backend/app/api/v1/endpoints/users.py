from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import Permissions, get_current_active_user, get_password_hash, require_permission
from app.models.pydantic.user import ManagedUserCreate, ManagedUserUpdate, UserResponse
from app.models.sql.role import Role
from app.models.sql.user import Person, User
from app.services.permission_service import PermissionService

router = APIRouter()


async def _response(db: AsyncSession, user: User) -> dict:
    permissions = await PermissionService.get_user_permissions(db, user.id)
    return {
        "id": str(user.id),
        "person_id": str(user.person_id),
        "email": user.email,
        "first_name": user.person.first_name,
        "last_name": user.person.last_name,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "roles": [role.name for role in user.roles],
        "permissions": permissions,
    }


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission(Permissions.USERS_MANAGE)),
):
    result = await db.execute(
        select(User).options(selectinload(User.person), selectinload(User.roles)).order_by(User.created_at.desc())
    )
    return [await _response(db, user) for user in result.scalars().all()]


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: ManagedUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission(Permissions.USERS_MANAGE)),
):
    person_result = await db.execute(select(Person).where(Person.id == data.person_id, Person.deleted_at.is_(None)))
    person = person_result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    existing = await db.execute(select(User).where(User.person_id == data.person_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This person already has login access")
    if not person.email:
        raise HTTPException(status_code=400, detail="The person must have an email before login access can be added")
    if not data.password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty")

    roles_result = await db.execute(select(Role).where(Role.name.in_(data.role_names)))
    roles = list(roles_result.scalars().all())
    if len(roles) != len(set(data.role_names)):
        raise HTTPException(status_code=400, detail="One or more roles were not found")

    user = User(
        id=str(uuid.uuid4()),
        person_id=str(person.id),
        email=person.email,
        password_hash=get_password_hash(data.password),
        is_active=True,
        roles=roles,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    result = await db.execute(
        select(User).options(selectinload(User.person), selectinload(User.roles)).where(User.id == user.id)
    )
    return await _response(db, result.scalar_one())


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: ManagedUserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission(Permissions.USERS_MANAGE)),
):
    result = await db.execute(
        select(User).options(selectinload(User.person), selectinload(User.roles)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(current_user.id) and data.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        if not data.password.strip():
            raise HTTPException(status_code=400, detail="Password cannot be empty")
        user.password_hash = get_password_hash(data.password)
    if data.role_names is not None:
        roles_result = await db.execute(select(Role).where(Role.name.in_(data.role_names)))
        roles = list(roles_result.scalars().all())
        if len(roles) != len(set(data.role_names)):
            raise HTTPException(status_code=400, detail="One or more roles were not found")
        user.roles = roles

    await db.commit()
    await db.refresh(user)
    return await _response(db, user)

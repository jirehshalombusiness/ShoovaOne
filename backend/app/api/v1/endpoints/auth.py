from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import timedelta

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, verify_password
from app.models.sql.user import User
from app.models.sql.role import Role
from app.models.pydantic.user import UserResponse, Token
from app.services.permission_service import PermissionService

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login endpoint for users."""
    # Find user by email with roles and permissions
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.person),
            selectinload(User.roles).selectinload(Role.permissions)
        )
        .where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )


    access_token_expires = timedelta(minutes=43200)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email},
        expires_delta=access_token_expires,
    )

    person = user.person
    
    # Get user permissions
    permissions = await PermissionService.get_user_permissions(db, user.id)
    roles = [role.name for role in user.roles]

    return {
    "access_token": access_token,
    "token_type": "bearer",
    "user": {
        "id": str(user.id),
        "email": user.email,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "profile_image_url": person.profile_image_url,   # ← ADD
        "job_title": person.job_title,                    # ← ADD
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "roles": roles,
        "permissions": permissions,
    },
}


@router.post("/logout")
async def logout(current_user = Depends(get_current_user)):
    """Logout endpoint."""
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get current user information with permissions."""
    # Reload user with roles and permissions
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.person),
            selectinload(User.roles).selectinload(Role.permissions)
        )
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    person = user.person
    permissions = await PermissionService.get_user_permissions(db, user.id)
    roles = [role.name for role in user.roles]
    
    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "profile_image_url": user.profile_image_url,
        "job_title": person.job_title if person else None,
        "roles": roles,
        "permissions": permissions,
    }
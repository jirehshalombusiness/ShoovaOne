from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.pydantic.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
)
from app.models.sql.role import Role
from app.models.sql.user import User
from app.services.email_service import send_password_reset_email
from app.services.password_reset_service import (
    create_password_reset_token,
    get_valid_password_reset_token,
    mark_password_reset_token_used,
)
from app.services.permission_service import PermissionService

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login endpoint for users."""

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

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=43200)

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
        },
        expires_delta=access_token_expires,
    )

    person = user.person

    permissions = await PermissionService.get_user_permissions(
        db,
        user.id,
    )

    roles = [role.name for role in user.roles]

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "first_name": person.first_name,
            "last_name": person.last_name,
            "profile_image_url": person.profile_image_url,
            "job_title": person.job_title,
            "is_active": user.is_active,
            "must_change_password": user.must_change_password,
            "created_at": user.created_at,
            "last_login_at": user.last_login_at,
            "roles": roles,
            "permissions": permissions,
        },
    }


@router.post("/logout")
async def logout(
    current_user=Depends(get_current_user),
):
    """Logout endpoint."""

    return {
        "message": "Successfully logged out"
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get current user information with permissions."""

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
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    person = user.person

    permissions = await PermissionService.get_user_permissions(
        db,
        user.id,
    )

    roles = [role.name for role in user.roles]

    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": person.first_name,
        "last_name": person.last_name,
        "profile_image_url": person.profile_image_url if person else None,
        "job_title": person.job_title if person else None,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "roles": roles,
        "permissions": permissions,
    }


# =============================================
# PASSWORD SECURITY
# =============================================

@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow an authenticated user to change their password."""

    if not verify_password(
        password_data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )

    if verify_password(
        password_data.new_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    current_user.password_hash = get_password_hash(
        password_data.new_password
    )

    current_user.must_change_password = False

    await db.commit()

    return {
        "message": "Password changed successfully"
    }


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request a password reset email.

    Always return the same response whether or not
    the email exists, to avoid exposing registered accounts.
    """

    result = await db.execute(
        select(User)
        .options(selectinload(User.person))
        .where(User.email == request.email)
    )

    user = result.scalar_one_or_none()

    if user and user.is_active:
        reset_token = await create_password_reset_token(
            db,
            user,
        )

        person = user.person

        send_password_reset_email(
            recipient_email=user.email,
            recipient_name=person.first_name if person else "",
            reset_token=reset_token,
        )

    return {
        "message": "If an account exists for that email, a password reset link has been sent."
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset a password using a valid reset token."""

    reset_token = await get_valid_password_reset_token(
        db,
        request.token,
    )

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )

    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset request",
        )

    user.password_hash = get_password_hash(
        request.new_password
    )

    user.must_change_password = False

    await db.commit()

    await mark_password_reset_token_used(
        db,
        reset_token,
    )

    return {
        "message": "Password reset successfully"
    }
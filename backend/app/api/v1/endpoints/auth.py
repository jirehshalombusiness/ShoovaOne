from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import timedelta

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    get_current_user,
    verify_password,
    get_password_hash,
)
from app.models.sql.user import User
from app.models.sql.role import Role

from app.models.pydantic.user import (
    UserResponse,
    Token,
    ChangePasswordRequest,
)
from app.services.permission_service import PermissionService
from app.services.password_reset_service import (
    create_password_reset_token,
    get_valid_password_reset_token,
    mark_password_reset_token_used,
)
from app.services.email_service import send_password_reset_email

router = APIRouter()

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

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
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
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
        "must_change_password": user.must_change_password,
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
        "must_change_password": user.must_change_password,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
        "profile_image_url": person.profile_image_url,
        "job_title": person.job_title if person else None,
        "roles": roles,
        "permissions": permissions,
    }


@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Allow an authenticated user to change their password."""

    # 1. Verify current password
    if not verify_password(
        password_data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # 2. Validate new password
    if len(password_data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )

    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password",
        )

    # 3. Update password
    current_user.password_hash = get_password_hash(
        password_data.new_password
    )

    # Password has been changed successfully
    current_user.must_change_password = False

    # 4. Save changes
    try:
        await db.commit()
        await db.refresh(current_user)

    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Password changed successfully"
    }  


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a password reset email.

    Always return the same response whether or not
    the email exists, to prevent email enumeration.
    """

    result = await db.execute(
        select(User)
        .options(selectinload(User.person))
        .where(User.email == request.email.lower().strip())
    )

    user = result.scalar_one_or_none()

    # Do not reveal whether an account exists
    if user is None:
        return {
            "message": "If an account exists for this email, "
                       "a password reset link has been sent."
        }

    # Do not allow password reset for inactive accounts
    if not user.is_active:
        return {
            "message": "If an account exists for this email, "
                       "a password reset link has been sent."
        }

    # Create secure reset token
    reset_token = await create_password_reset_token(
        db=db,
        user=user,
    )

    # Get recipient name
    recipient_name = "there"

    if user.person:
        recipient_name = user.person.first_name

    # Send reset email
    try:
        send_password_reset_email(
            recipient_email=user.email,
            recipient_name=recipient_name,
            reset_token=reset_token,
        )
    except Exception as e:
        print(f"Password reset email error: {e}")

    return {
        "message": "If an account exists for this email, "
                   "a password reset link has been sent."
    }    



@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reset a user's password using a valid password reset token.
    """

    # 1. Validate the reset token
    reset_token = await get_valid_password_reset_token(
        db=db,
        raw_token=request.token,
    )

    if reset_token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link",
        )

    # 2. Validate the new password
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long",
        )

    # 3. Load the user
    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link",
        )

    # 4. Make sure the account is still active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link",
        )

    # 5. Set the new password
    user.password_hash = get_password_hash(
        request.new_password
    )

    # A successful password reset satisfies any forced password change
    user.must_change_password = False

    # 6. Make the reset token single-use
    await mark_password_reset_token_used(
        db=db,
        reset_token=reset_token,
    )

    return {
        "message": "Password reset successfully"
    }
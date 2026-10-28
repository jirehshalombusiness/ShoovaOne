from datetime import datetime, timedelta, timezone
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.email_utils import normalize_email
from app.core.rate_limit import auth_limiter
from app.core.security import (
    create_access_token,
    get_current_user,
    get_password_hash,
    password_fingerprint,
    validate_password_strength,
    verify_password,
)
from app.models.pydantic.core.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    Token,
    UserResponse,
)
from app.models.sql.core.role import Role
from app.models.sql.core.user import User
from app.services.auth.email_service import send_password_reset_email
from app.services.auth.password_reset_service import (
    create_password_reset_token,
    get_valid_password_reset_token,
    mark_password_reset_token_used,
)
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService


router = APIRouter()

LOGIN_IP_LIMIT = 50
LOGIN_IP_WINDOW_SECONDS = 300
LOGIN_FAILURE_LIMIT = 5
LOGIN_FAILURE_WINDOW_SECONDS = 900

FORGOT_IP_LIMIT = 5
FORGOT_EMAIL_LIMIT = 3
FORGOT_WINDOW_SECONDS = 900

RESET_IP_LIMIT = 10
RESET_WINDOW_SECONDS = 900

# Verified against when the account does not exist so response timing does
# not reveal which emails are registered.
_DUMMY_PASSWORD_HASH = get_password_hash(secrets.token_urlsafe(32))


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    if request.client:
        return request.client.host
    return "unknown"


def _too_many_attempts(retry_after: int, detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(retry_after)},
    )


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login endpoint for users."""

    email = normalize_email(form_data.username).lower()
    ip_address = _client_ip(request)

    retry_after = await auth_limiter.retry_after(
        f"login-ip:{ip_address}",
        limit=LOGIN_IP_LIMIT,
        window_seconds=LOGIN_IP_WINDOW_SECONDS,
    )
    if retry_after:
        raise _too_many_attempts(
            retry_after,
            "Too many sign-in attempts. Please try again later.",
        )

    retry_after = await auth_limiter.retry_after(
        f"login-account:{email}",
        limit=LOGIN_FAILURE_LIMIT,
        window_seconds=LOGIN_FAILURE_WINDOW_SECONDS,
    )
    if retry_after:
        await AuditService.log(
            db=db,
            action="AUTH_LOGIN_BLOCKED",
            entity_type="auth",
            entity_id=str(uuid.uuid4()),
            metadata={"email": email},
            request=request,
        )
        await db.commit()
        raise _too_many_attempts(
            retry_after,
            "Too many failed sign-in attempts. Please try again later.",
        )

    await auth_limiter.record(
        f"login-ip:{ip_address}",
        window_seconds=LOGIN_IP_WINDOW_SECONDS,
    )

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.person),
            selectinload(User.roles).selectinload(Role.permissions),
        )
        .where(User.email == email)
    )

    user = result.scalar_one_or_none()

    password_hash = (
        user.password_hash
        if user is not None and user.password_hash
        else _DUMMY_PASSWORD_HASH
    )

    password_ok = verify_password(form_data.password, password_hash)

    if user is None or not password_ok:
        await auth_limiter.record(
            f"login-account:{email}",
            window_seconds=LOGIN_FAILURE_WINDOW_SECONDS,
        )
        await AuditService.log(
            db=db,
            action="AUTH_LOGIN_FAILED",
            entity_type="auth",
            entity_id=str(user.id) if user is not None else str(uuid.uuid4()),
            metadata={"email": email, "reason": "bad_credentials"},
            request=request,
        )
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        await AuditService.log(
            db=db,
            actor=user,
            action="AUTH_LOGIN_INACTIVE",
            entity_type="auth",
            entity_id=str(user.id),
            metadata={"email": email},
            request=request,
        )
        await db.commit()

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    await auth_limiter.reset(f"login-account:{email}")

    access_token_expires = timedelta(
        minutes=settings.JWT_EXPIRATION_MINUTES
    )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "pwdv": password_fingerprint(user.password_hash),
        },
        expires_delta=access_token_expires,
    )

    person = user.person

    permissions = await PermissionService.get_user_permissions(
        db,
        user.id,
    )

    roles = [role.name for role in user.roles]

    user.last_login_at = datetime.now(timezone.utc)

    await AuditService.log(
        db=db,
        actor=user,
        action="AUTH_LOGIN_SUCCESS",
        entity_type="auth",
        entity_id=str(user.id),
        metadata={"email": email},
        request=request,
    )

    await db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "person_id": str(user.person_id) if user.person_id else None,
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
            selectinload(User.roles).selectinload(Role.permissions),
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
        "person_id": str(user.person_id) if user.person_id else None,
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

    # Verify current password
    if not verify_password(
        password_data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password
    validate_password_strength(
        password_data.new_password,
        email=current_user.email,
    )

    if verify_password(
        password_data.new_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    # Update password
    current_user.password_hash = get_password_hash(
        password_data.new_password
    )

    current_user.must_change_password = False

    try:
        await db.commit()
        await db.refresh(current_user)
    except Exception:
        await db.rollback()
        raise

    # The password fingerprint changed, so every token issued under the
    # old password (including this session) is now invalid. Hand back a
    # fresh token so the user is not signed out mid-flow.
    access_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "email": current_user.email,
            "pwdv": password_fingerprint(current_user.password_hash),
        },
        expires_delta=timedelta(minutes=settings.JWT_EXPIRATION_MINUTES),
    )

    return {
        "message": "Password changed successfully",
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    password_data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send a password reset email.

    Always return the same response whether or not
    the email exists, to prevent email enumeration.
    """

    ip_address = _client_ip(request)

    retry_after = await auth_limiter.retry_after(
        f"forgot-ip:{ip_address}",
        limit=FORGOT_IP_LIMIT,
        window_seconds=FORGOT_WINDOW_SECONDS,
    )
    if retry_after:
        raise _too_many_attempts(
            retry_after,
            "Too many reset requests. Please try again later.",
        )

    await auth_limiter.record(
        f"forgot-ip:{ip_address}",
        window_seconds=FORGOT_WINDOW_SECONDS,
    )

    email = password_data.email.lower().strip()

    retry_after = await auth_limiter.retry_after(
        f"forgot-email:{email}",
        limit=FORGOT_EMAIL_LIMIT,
        window_seconds=FORGOT_WINDOW_SECONDS,
    )
    if retry_after:
        # Silently skip sending to avoid mail-bombing the mailbox while
        # keeping the response indistinguishable from a normal request.
        return {
            "message": "If an account exists for this email, "
                       "a password reset link has been sent."
        }

    await auth_limiter.record(
        f"forgot-email:{email}",
        window_seconds=FORGOT_WINDOW_SECONDS,
    )

    result = await db.execute(
        select(User)
        .options(selectinload(User.person))
        .where(User.email == email)
    )

    user = result.scalar_one_or_none()

    # Do not reveal whether an account exists
    if user is None or not user.is_active:
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
    request: Request,
    password_data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password using a valid password reset token."""

    ip_address = _client_ip(request)

    retry_after = await auth_limiter.retry_after(
        f"reset-ip:{ip_address}",
        limit=RESET_IP_LIMIT,
        window_seconds=RESET_WINDOW_SECONDS,
    )
    if retry_after:
        raise _too_many_attempts(
            retry_after,
            "Too many reset attempts. Please try again later.",
        )

    await auth_limiter.record(
        f"reset-ip:{ip_address}",
        window_seconds=RESET_WINDOW_SECONDS,
    )

    # Validate the reset token
    reset_token = await get_valid_password_reset_token(
        db=db,
        raw_token=password_data.token,
    )

    if reset_token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset link",
        )

    # Load the user
    result = await db.execute(
        select(User).where(User.id == reset_token.user_id)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link",
        )

    # Make sure the account is still active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password reset link",
        )

    # Validate the new password
    validate_password_strength(
        password_data.new_password,
        email=user.email,
    )

    # Set the new password
    user.password_hash = get_password_hash(
        password_data.new_password
    )

    # A successful password reset satisfies any forced password change
    user.must_change_password = False

    # Make the reset token single-use
    await mark_password_reset_token_used(
        db=db,
        reset_token=reset_token,
    )

    await db.commit()

    return {
        "message": "Password reset successfully"
    }
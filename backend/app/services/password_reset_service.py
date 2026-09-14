import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.password_reset_token import PasswordResetToken
from app.models.sql.user import User


RESET_TOKEN_EXPIRE_MINUTES = 30


def hash_reset_token(token: str) -> str:
    """
    Hash a password reset token before storing it in the database.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def create_password_reset_token(
    db: AsyncSession,
    user: User,
) -> str:
    """
    Create a secure password reset token.

    Only the hashed token is stored in the database.
    The raw token is returned so it can be included in the reset link.
    """

    # Invalidate any existing unused reset tokens for this user
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )

    existing_tokens = result.scalars().all()

    for reset_token in existing_tokens:
        reset_token.used_at = datetime.now(timezone.utc)

    # Generate a cryptographically secure random token
    raw_token = secrets.token_urlsafe(48)

    # Store only the hash
    token_hash = hash_reset_token(raw_token)

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=RESET_TOKEN_EXPIRE_MINUTES
    )

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    db.add(reset_token)
    await db.commit()

    return raw_token


async def get_valid_password_reset_token(
    db: AsyncSession,
    raw_token: str,
) -> PasswordResetToken | None:
    """
    Find a valid password reset token.

    A token must:
    - exist
    - not have been used
    - not have expired
    """

    token_hash = hash_reset_token(raw_token)

    result = await db.execute(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == token_hash)
    )

    reset_token = result.scalar_one_or_none()

    if reset_token is None:
        return None

    if reset_token.used_at is not None:
        return None

    now = datetime.now(timezone.utc)

    expires_at = reset_token.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        return None

    return reset_token


async def mark_password_reset_token_used(
    db: AsyncSession,
    reset_token: PasswordResetToken,
) -> None:
    """
    Mark a password reset token as used.
    """
    reset_token.used_at = datetime.now(timezone.utc)

    await db.commit()
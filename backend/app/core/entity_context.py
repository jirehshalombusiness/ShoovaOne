"""Request-scoped workspace (legal entity) context.

The active entity is resolved per request from the authenticated user's
memberships and the ``X-Entity-Id`` header. It is stored in a ContextVar so
SQLAlchemy and services can scope reads without threading a parameter through
every call.

``None`` means "no workspace selected" (background jobs, scripts, seeds),
which leaves queries unscoped.
"""

from contextvars import ContextVar, Token
from typing import Optional

_active_entity_id: ContextVar[Optional[str]] = ContextVar(
    "active_entity_id",
    default=None,
)


def set_active_entity_id(entity_id: Optional[str]) -> Token:
    return _active_entity_id.set(str(entity_id) if entity_id else None)


def get_active_entity_id() -> Optional[str]:
    return _active_entity_id.get()


def reset_active_entity_id(token: Token) -> None:
    _active_entity_id.reset(token)

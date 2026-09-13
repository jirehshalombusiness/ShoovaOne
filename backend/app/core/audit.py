from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sql.audit_log import AuditLog
import uuid
from typing import Optional, Dict, Any


async def log_action(
    db: AsyncSession,
    actor_user_id: Optional[str],
    actor_person_id: Optional[str],
    action: str,
    entity_type: str,
    entity_id: str,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
):
    """Record an action in the audit log."""
    log = AuditLog(
        id=str(uuid.uuid4()),
        actor_user_id=actor_user_id,
        actor_person_id=actor_person_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
    )
    db.add(log)
    # Don't commit here — let the caller commit
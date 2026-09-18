from typing import Any, Optional

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql.audit_log import AuditLog
from app.models.sql.user import User


class AuditService:
    """
    Central service for recording audit events.

    Audit logs record:
    - who performed the action
    - what action was performed
    - what entity was affected
    - what changed
    - request information such as IP and user agent
    """

    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        actor: Optional[User] = None,
        action: str,
        entity_type: str,
        entity_id: Any,
        description: Optional[str] = None,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        metadata: Optional[dict] = None,
        request: Optional[Request] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.

        The caller should invoke this only after the
        underlying action has succeeded.
        """

        actor_user_id = None
        actor_person_id = None

        if actor is not None:
            actor_user_id = actor.id
            actor_person_id = getattr(actor, "person_id", None)

        ip_address = None
        user_agent = None

        if request is not None:
            forwarded_for = request.headers.get("X-Forwarded-For")

            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            elif request.client:
                ip_address = request.client.host

            user_agent = request.headers.get("User-Agent")

        audit_log = AuditLog(
            actor_user_id=actor_user_id,
            actor_person_id=actor_person_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            old_values=old_values,
            new_values=new_values,
            metadata_=metadata,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        db.add(audit_log)

        await db.flush()

        return audit_log
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    actor_user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    actor_person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
    )

    action = Column(
        String(50),
        nullable=False,
    )

    entity_type = Column(
        String(50),
        nullable=False,
    )

    entity_id = Column(
        GUID,
        nullable=False,
    )

    old_values = Column(JSON)

    new_values = Column(JSON)

    metadata_ = Column(
        "metadata",
        JSON,
    )

    description = Column(
        String(255),
        nullable=True,
    )

    ip_address = Column(String(45))

    user_agent = Column(String)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    actor = relationship(
        "Person",
        foreign_keys=[actor_person_id],
        lazy="selectin",
    )
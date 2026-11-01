from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import Base, BaseModel, GUID


# Entity-specific role grants. A role granted in user_roles applies across
# every workspace the user belongs to; a grant here applies only inside the
# named entity.
user_entity_roles = Table(
    "user_entity_roles",
    Base.metadata,
    Column(
        "user_id",
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "entity_id",
        GUID,
        ForeignKey("entities.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        GUID,
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


class Entity(BaseModel):
    """A legal entity (or other accountable workspace) owned by Shoova."""

    __tablename__ = "entities"

    code = Column(String(20), nullable=False, unique=True)
    name = Column(String(200), nullable=False)
    legal_name = Column(String(255), nullable=True)
    country_code = Column(String(2), nullable=False)
    currency = Column(String(3), nullable=False)
    timezone = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="active")

    memberships = relationship(
        "UserEntityMembership",
        back_populates="entity",
        cascade="all, delete-orphan",
    )


class UserEntityMembership(BaseModel):
    """Grants a user access to a workspace without duplicating the account."""

    __tablename__ = "user_entity_memberships"

    user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id = Column(
        GUID,
        ForeignKey("entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_default = Column(Boolean, nullable=False, default=False)
    access_level = Column(String(20), nullable=False, default="member")

    entity = relationship("Entity", back_populates="memberships")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "entity_id",
            name="uq_user_entity_membership",
        ),
    )

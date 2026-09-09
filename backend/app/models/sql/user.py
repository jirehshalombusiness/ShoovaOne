from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.models.sql.base import BaseModel, Base
from app.models.sql.role import user_roles
from app.core.config import settings

# Determine column type based on database
if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)


class User(BaseModel):
    __tablename__ = "users"

    person_id = Column(FK_TYPE, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255))
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))

    # Relationships
    person = relationship("Person", back_populates="user", lazy="selectin")
    roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="selectin")


class Person(BaseModel):
    __tablename__ = "people"

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    date_of_birth = Column(DateTime)
    gender = Column(String(20))
    type = Column(String(50), nullable=False, default="staff")
    profile_image_url = Column(String)
    address = Column(String)
    city = Column(String(100))
    state = Column(String(100))
    country = Column(String(100))
    postal_code = Column(String(20))
    emergency_contact_name = Column(String(200))
    emergency_contact_phone = Column(String(50))
    emergency_contact_relationship = Column(String(100))
    bio = Column(String)
    skills = Column(String)
    deleted_at = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="person", uselist=False, lazy="selectin")
    attendance = relationship("Attendance", back_populates="person", lazy="selectin")
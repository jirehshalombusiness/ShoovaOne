from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID
from app.models.sql.role import user_roles, user_permissions


class User(BaseModel):
    __tablename__ = "users"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(String(255))

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )

    # Security: users created with temporary passwords
    # must choose a new password before using the system.
    must_change_password = Column(
        Boolean,
        default=False,
        nullable=False
    )

    last_login_at = Column(DateTime(timezone=True))

    # Relationships
    person = relationship(
        "Person",
        back_populates="user",
        lazy="selectin"
    )

    roles = relationship(
        "Role",
        secondary=user_roles,
        back_populates="users",
        lazy="selectin"
    )

    direct_permissions = relationship(
        "Permission",
        secondary=user_permissions,
        primaryjoin="User.id == user_permissions.c.user_id",
        secondaryjoin="Permission.id == user_permissions.c.permission_id",
        lazy="selectin",
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        lazy="selectin"
    )


class Person(BaseModel):
    __tablename__ = "people"

    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    date_of_birth = Column(DateTime)
    gender = Column(String(20))
    type = Column(String(50), nullable=False, default="staff")
    status = Column(String(50), default="active")

    # Org chart fields
    job_title = Column(String(200), nullable=True)
    location = Column(String(100), nullable=True)
    employment_type = Column(String(50), nullable=True)
    reports_to_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True
    )

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
    user = relationship(
        "User",
        back_populates="person",
        uselist=False,
        lazy="selectin"
    )

    attendance = relationship(
        "Attendance",
        back_populates="person",
        lazy="selectin"
    )

    # Self-referential for org chart
    reports_to = relationship(
        "Person",
        remote_side="Person.id",
        foreign_keys=[reports_to_id],
        backref="direct_reports",
    )
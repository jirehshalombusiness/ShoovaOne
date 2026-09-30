from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Budget(BaseModel):
    __tablename__ = "budgets"

    budget_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
        index=True,
    )

    description = Column(
        Text,
        nullable=True,
    )

    fiscal_year = Column(
        String(10),
        nullable=False,
        index=True,
    )

    start_date = Column(
        Date,
        nullable=False,
    )

    end_date = Column(
        Date,
        nullable=False,
    )

    amount = Column(
        Numeric(15, 2),
        nullable=False,
    )

    currency = Column(
        String(3),
        nullable=False,
        default="GHS",
    )

    status = Column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )

    organisation_id = Column(
        GUID,
        ForeignKey("organisations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    department_id = Column(
        GUID,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    programme_id = Column(
        GUID,
        ForeignKey("programmes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    project_id = Column(
        GUID,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    submitted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    approved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    activated_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    closed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    submitted_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    approved_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    activated_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    closed_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    organisation = relationship(
        "Organisation",
        foreign_keys=[organisation_id],
    )

    department = relationship(
        "Department",
        foreign_keys=[department_id],
    )

    programme = relationship(
        "Programme",
        foreign_keys=[programme_id],
    )

    project = relationship(
        "Project",
        foreign_keys=[project_id],
    )

    submitted_by = relationship(
        "Person",
        foreign_keys=[submitted_by_id],
    )

    approved_by = relationship(
        "Person",
        foreign_keys=[approved_by_id],
    )

    activated_by = relationship(
        "Person",
        foreign_keys=[activated_by_id],
    )

    closed_by = relationship(
        "Person",
        foreign_keys=[closed_by_id],
    )

    created_by = relationship(
        "Person",
        foreign_keys=[created_by_id],
    )
from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Expense(BaseModel):
    __tablename__ = "expenses"

    expense_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    title = Column(
        String(200),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    category = Column(
        String(100),
        nullable=False,
        index=True,
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

    incurred_date = Column(
        Date,
        nullable=False,
    )

    requester_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    project_id = Column(
        GUID,
        ForeignKey(
            "projects.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    programme_id = Column(
        GUID,
        nullable=True,
    )

    department_id = Column(
        GUID,
        nullable=True,
    )

    vendor_name = Column(
        String(200),
        nullable=True,
    )

    vendor_reference = Column(
        String(100),
        nullable=True,
    )

    payment_method = Column(
        String(50),
        nullable=True,
    )

    status = Column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )

    submitted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    approved_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    paid_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    reconciled_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    reviewer_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    approver_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    payer_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    reconciler_id = Column(
        GUID,
        ForeignKey(
            "people.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    review_notes = Column(
        Text,
        nullable=True,
    )

    approval_notes = Column(
        Text,
        nullable=True,
    )

    rejection_reason = Column(
        Text,
        nullable=True,
    )

    payment_notes = Column(
        Text,
        nullable=True,
    )

    reconciliation_notes = Column(
        Text,
        nullable=True,
    )

    requester = relationship(
        "Person",
        foreign_keys=[requester_id],
        lazy="selectin",
    )

    reviewer = relationship(
        "Person",
        foreign_keys=[reviewer_id],
        lazy="selectin",
    )

    approver = relationship(
        "Person",
        foreign_keys=[approver_id],
        lazy="selectin",
    )

    payer = relationship(
        "Person",
        foreign_keys=[payer_id],
        lazy="selectin",
    )

    reconciler = relationship(
        "Person",
        foreign_keys=[reconciler_id],
        lazy="selectin",
    )

    project = relationship(
        "Project",
        foreign_keys=[project_id],
        lazy="selectin",
    )
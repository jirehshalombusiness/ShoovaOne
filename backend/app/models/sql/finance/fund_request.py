from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class FundRequest(BaseModel):
    __tablename__ = "fund_requests"

    # Institutional reference number
    request_number = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )

    # Request information
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)

    # Ownership / organisational context
    requester_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="RESTRICT"),
        nullable=False,
    )

    project_id = Column(
        GUID,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Programme is currently represented in Project as programme_id,
    # so we keep this as a reference without assuming a Programme model.

    programme_id = Column(GUID, nullable=True)
    department_id = Column(GUID, nullable=True)

    # Financial information
    amount_requested = Column(
        Numeric(15, 2),
        nullable=False,
    )

    currency = Column(
        String(3),
        nullable=False,
        default="GHS",
    )

    approved_amount = Column(
        Numeric(15, 2),
        nullable=True,
    )

    amount_disbursed = Column(
        Numeric(15, 2),
        nullable=False,
        default=0,
    )

    # Workflow
    status = Column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )

    # Important dates
    required_by_date = Column(Date, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=True)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)

    # Governance / accountability
    reviewer_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    approver_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    disburser_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    reconciler_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    rejection_reason = Column(Text, nullable=True)
    review_notes = Column(Text, nullable=True)
    approval_notes = Column(Text, nullable=True)
    disbursement_notes = Column(Text, nullable=True)
    reconciliation_notes = Column(Text, nullable=True)

    # Relationships
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

    disburser = relationship(
        "Person",
        foreign_keys=[disburser_id],
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
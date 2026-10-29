from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class FundRequest(BaseModel):
    """
    A staff claim for money: either an advance before spending or a
    reimbursement for money already spent.

    Approval chain (each stage assigned to one person):
        manager -> finance -> CEO

    Stages that would be self-approval are skipped when the chain is
    built. After the CEO approves, Finance disburses in one or more
    payments. The claim only closes once the requester has handed the
    signed hardcopy receipts to Finance and Finance verifies them.
    """

    __tablename__ = "fund_requests"

    request_number = Column(String(50), unique=True, nullable=False, index=True)

    # ---- request information ----
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)

    # advance     -> money needed before spending
    # reimbursement -> money already spent from personal funds
    request_type = Column(
        String(20),
        nullable=False,
        default="reimbursement",
        index=True,
    )
    expense_date = Column(Date, nullable=True)

    # ---- ownership / organisational context ----
    requester_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        GUID,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
    )
    programme_id = Column(GUID, nullable=True)
    department_id = Column(GUID, nullable=True)

    # ---- financial information ----
    amount_requested = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="GHS")
    approved_amount = Column(Numeric(15, 2), nullable=True)
    amount_disbursed = Column(Numeric(15, 2), nullable=False, default=0)

    # ---- workflow ----
    # draft | submitted | manager_approved | finance_approved | approved
    # | disbursed | verified | verification_failed | rejected | cancelled
    status = Column(String(30), nullable=False, default="draft", index=True)

    # manager | finance | ceo | disbursement | verification | closed
    current_stage = Column(String(20), nullable=True, index=True)

    # Link to the current approval inbox row
    approval_id = Column(
        GUID,
        ForeignKey("approval_requests.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ---- dates ----
    required_by_date = Column(Date, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    disbursed_at = Column(DateTime(timezone=True), nullable=True)

    # ---- stage decisions ----
    manager_decided_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    manager_decided_at = Column(DateTime(timezone=True), nullable=True)
    manager_decision_note = Column(Text, nullable=True)

    finance_decided_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    finance_decided_at = Column(DateTime(timezone=True), nullable=True)
    finance_decision_note = Column(Text, nullable=True)

    ceo_decided_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    ceo_decided_at = Column(DateTime(timezone=True), nullable=True)
    ceo_decision_note = Column(Text, nullable=True)

    # ---- payment ----
    disburser_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    disbursement_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # ---- hardcopy receipt verification ----
    receipt_required = Column(Boolean, nullable=False, default=True)
    receipt_reference = Column(String(120), nullable=True)
    receipt_verified_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    receipt_verified_at = Column(DateTime(timezone=True), nullable=True)
    receipt_verification_note = Column(Text, nullable=True)

    # ---- relationships ----
    requester = relationship(
        "Person",
        foreign_keys=[requester_id],
        lazy="selectin",
    )
    manager_decider = relationship(
        "Person",
        foreign_keys=[manager_decided_by_id],
        lazy="selectin",
    )
    finance_decider = relationship(
        "Person",
        foreign_keys=[finance_decided_by_id],
        lazy="selectin",
    )
    ceo_decider = relationship(
        "Person",
        foreign_keys=[ceo_decided_by_id],
        lazy="selectin",
    )
    disburser = relationship(
        "Person",
        foreign_keys=[disburser_id],
        lazy="selectin",
    )
    receipt_verifier = relationship(
        "Person",
        foreign_keys=[receipt_verified_by_id],
        lazy="selectin",
    )
    project = relationship(
        "Project",
        foreign_keys=[project_id],
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_fund_requests_requester_status", "requester_id", "status"),
        Index("ix_fund_requests_stage_status", "current_stage", "status"),
    )

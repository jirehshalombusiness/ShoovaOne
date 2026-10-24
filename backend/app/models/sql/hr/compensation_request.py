from sqlalchemy import (
    Column,
    String,
    Date,
    DECIMAL,
    ForeignKey,
    Text,
    DateTime,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class CompensationRequest(BaseModel):
    """
    An employee's request for a compensation adjustment.

    Flow:
    1. Employee submits (via /me/compensation/requests)
    2. Head of HR reviews
    3. If approved, Head of HR forwards to CEO
    4. CEO approves / rejects (final)

    On final approval, HR may create a CompensationChange row to
    actually apply the new salary, referencing this request.
    """

    __tablename__ = "compensation_requests"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # What the employee asked for
    requested_amount = Column(DECIMAL(15, 2), nullable=True)
    currency = Column(String(3), default="GHS", nullable=False)
    frequency = Column(String(20), default="monthly", nullable=False)
    reason = Column(Text, nullable=False)

    # Decision state
    #   pending_hr      → waiting for head_of_hr
    #   pending_ceo     → HR approved, waiting for CEO
    #   approved        → CEO approved (or HR-only if policy allows)
    #   rejected        → rejected at either stage
    #   cancelled       → employee withdrew
    status = Column(String(30), default="pending_hr", nullable=False, index=True)

    # Who decided at each stage
    hr_decided_by_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    hr_decided_at = Column(DateTime(timezone=True), nullable=True)
    hr_decision_note = Column(Text, nullable=True)

    ceo_decided_by_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    ceo_decided_at = Column(DateTime(timezone=True), nullable=True)
    ceo_decision_note = Column(Text, nullable=True)

    # Link to the approval inbox row
    approval_id = Column(
        GUID,
        ForeignKey("approval_requests.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Link to the applied change (if approved and applied)
    applied_change_id = Column(
        GUID,
        ForeignKey("compensation_changes.id", ondelete="SET NULL"),
        nullable=True,
    )

    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
    hr_decider = relationship("Person", foreign_keys=[hr_decided_by_id], lazy="selectin")
    ceo_decider = relationship("Person", foreign_keys=[ceo_decided_by_id], lazy="selectin")
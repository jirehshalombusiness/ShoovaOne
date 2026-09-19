from sqlalchemy import (
    Column, String, Text, Integer, DateTime, ForeignKey, Index, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class ApprovalRequest(BaseModel):
    """
    A single unit of work that requires a decision from a specific person.

    Every approval-worthy action in the system creates one row here:
    - leave requests
    - timesheet submissions
    - document verifications
    - profile change requests
    - compensation changes
    - contract renewals
    - terminations

    The entity_type + entity_id pair points at the domain row that
    actually holds the data. This table holds routing and decision state.

    status flow:
        pending   -> approved
        pending   -> rejected
        pending   -> cancelled     (requester withdrew)
        pending   -> escalated     (assigned_to changed, still pending)
    """

    __tablename__ = "approval_requests"

    # ---- what is being approved ----
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(GUID, nullable=False)

    # ---- who asked ----
    requested_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- who must decide ----
    assigned_to_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ---- decision state ----
    status = Column(String(30), nullable=False, default="pending", index=True)
    priority = Column(String(20), nullable=False, default="normal")

    # ---- escalation ----
    # 0 = direct manager
    # 1 = HR
    # 2 = exec (director / executive_director)
    escalation_level = Column(Integer, nullable=False, default=0)

    # ---- SLA ----
    due_at = Column(DateTime(timezone=True), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)

    # ---- decision ----
    decided_at = Column(DateTime(timezone=True), nullable=True)
    decided_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    decision_note = Column(Text, nullable=True)

    # ---- context for the approver ----
    # Short human-readable summary shown in the inbox list
    title = Column(String(255), nullable=False)
    # Optional longer description
    summary = Column(Text, nullable=True)

    # ---- relationships ----
    requested_by = relationship(
        "Person",
        foreign_keys=[requested_by_id],
        lazy="selectin",
    )
    assigned_to = relationship(
        "Person",
        foreign_keys=[assigned_to_id],
        lazy="selectin",
    )
    decided_by = relationship(
        "Person",
        foreign_keys=[decided_by_id],
        lazy="selectin",
    )
    comments = relationship(
        "ApprovalComment",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="ApprovalComment.created_at",
    )

    __table_args__ = (
        Index("ix_approval_entity", "entity_type", "entity_id"),
        Index("ix_approval_assigned_status", "assigned_to_id", "status"),
        Index("ix_approval_requested_status", "requested_by_id", "status"),
    )


class ApprovalComment(BaseModel):
    """
    A threaded comment on an approval request.

    Approvers and requesters can both comment.
    HR can comment on any request they can see.
    """

    __tablename__ = "approval_comments"

    approval_request_id = Column(
        GUID,
        ForeignKey("approval_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    author_person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
    )

    body = Column(Text, nullable=False)

    # Internal comments are visible only to HR/approvers, not the requester
    is_internal = Column(Boolean, nullable=False, default=False)

    author = relationship("Person", lazy="selectin")
    request = relationship("ApprovalRequest", back_populates="comments")
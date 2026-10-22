from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    Date,
    Time,
    DateTime,
    Boolean,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


# ============================================================
# MEETING
# ============================================================

class Meeting(BaseModel):
    """
    A scheduled meeting between internal staff and any mix of attendees.

    Fields cover:
    - when (starts_at / ends_at / duration)
    - where (physical location OR meeting_url for video)
    - who (organizer + attendees table)
    - what (title, description, agenda items)
    - context (linked project or opportunity, optional)
    """

    __tablename__ = "meetings"

    # ---- basics ----
    title = Column(String(255), nullable=False)
    description = Column(Text)

    # ---- timing ----
    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=30)

    # ---- where ----
    location_type = Column(String(30), nullable=False, default="video")
    # in_person / video / phone
    location = Column(String(255), nullable=True)
    # for in_person: "Conference Room A"
    # for phone: "+233 20 123 4567"
    meeting_url = Column(Text, nullable=True)
    # for video: "https://meet.google.com/abc-def-ghi"
    # any URL the user pastes

    # ---- who ----
    organizer_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---- state ----
    status = Column(String(30), nullable=False, default="scheduled", index=True)
    # scheduled / cancelled / completed
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancellation_reason = Column(Text, nullable=True)

    # ---- recurrence (v1: stored but not auto-scheduled) ----
    recurrence = Column(String(30), nullable=True)
    # none / daily / weekly / biweekly / monthly
    # v1: informational only. Future: generate instances.

    # ---- context (optional linkage) ----
    project_id = Column(
        GUID,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    opportunity_id = Column(
        GUID,
        ForeignKey("opportunities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ---- relationships ----
    organizer = relationship(
        "Person",
        foreign_keys=[organizer_id],
        lazy="selectin",
    )
    cancelled_by = relationship(
        "Person",
        foreign_keys=[cancelled_by_id],
        lazy="selectin",
    )
    project = relationship("Project", lazy="selectin")
    opportunity = relationship("Opportunity", lazy="selectin")

    attendees = relationship(
        "MeetingAttendee",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="MeetingAttendee.created_at",
    )
    agenda_items = relationship(
        "MeetingAgendaItem",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="MeetingAgendaItem.position",
    )


# ============================================================
# MEETING ATTENDEE
# ============================================================

class MeetingAttendee(BaseModel):
    __tablename__ = "meeting_attendees"

    meeting_id = Column(
        GUID,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = Column(String(30), nullable=False, default="required")
    # required / optional

    response = Column(String(30), nullable=False, default="pending")
    # pending / accepted / declined / tentative

    responded_at = Column(DateTime(timezone=True), nullable=True)
    response_note = Column(Text, nullable=True)

    meeting = relationship("Meeting", back_populates="attendees")
    person = relationship("Person", lazy="selectin")


# ============================================================
# MEETING AGENDA ITEM
# ============================================================

class MeetingAgendaItem(BaseModel):
    __tablename__ = "meeting_agenda_items"

    meeting_id = Column(
        GUID,
        ForeignKey("meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    notes = Column(Text, nullable=True)
    completed = Column(Boolean, nullable=False, default=False)

    meeting = relationship("Meeting", back_populates="agenda_items")
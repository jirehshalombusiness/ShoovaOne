from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Event(BaseModel):
    """
    An organisational event: training, workshop, conference, outreach, etc.

    Visibility is controlled by status:
    - draft      only visible to users who can manage events
    - published  visible to everyone with events.view
    - cancelled  visible with the cancellation reason
    """

    __tablename__ = "events"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(50), nullable=False, default="general")
    status = Column(String(30), nullable=False, default="draft", index=True)

    starts_at = Column(DateTime(timezone=True), nullable=False, index=True)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    all_day = Column(Boolean, nullable=False, default=False)

    location = Column(String(255), nullable=True)
    is_virtual = Column(Boolean, nullable=False, default=False)
    meeting_url = Column(Text, nullable=True)

    # Optional context links. Events survive deletion of the linked record.
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

    organiser_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    published_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    cancellation_reason = Column(Text, nullable=True)

    organiser = relationship(
        "Person",
        foreign_keys=[organiser_id],
        lazy="selectin",
    )
    cancelled_by = relationship(
        "Person",
        foreign_keys=[cancelled_by_id],
        lazy="selectin",
    )
    organisation = relationship("Organisation", lazy="selectin")
    department = relationship("Department", lazy="selectin")
    programme = relationship("Programme", lazy="selectin")
    project = relationship("Project", lazy="selectin")

    attendees = relationship(
        "EventAttendee",
        back_populates="event",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="EventAttendee.created_at",
    )


class EventAttendee(BaseModel):
    __tablename__ = "event_attendees"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "person_id",
            name="uq_event_attendees_event_person",
        ),
    )

    event_id = Column(
        GUID,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = Column(String(30), nullable=False, default="attendee")
    # attendee / speaker / volunteer

    response = Column(String(30), nullable=False, default="pending")
    # pending / accepted / declined / tentative

    responded_at = Column(DateTime(timezone=True), nullable=True)
    response_note = Column(Text, nullable=True)

    event = relationship("Event", back_populates="attendees")
    person = relationship("Person", lazy="selectin")

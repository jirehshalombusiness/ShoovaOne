from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, or_, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.sql.meetings.meeting import Meeting, MeetingAttendee, MeetingAgendaItem
from app.models.sql.core.notification import Notification
from app.models.sql.core.user import Person, User
from app.services.core.audit_service import AuditService


# ============================================================
# CONSTANTS
# ============================================================

VALID_LOCATION_TYPES = {"in_person", "video", "phone"}
VALID_STATUSES = {"scheduled", "cancelled", "completed"}
VALID_RESPONSES = {"pending", "accepted", "declined", "tentative"}
VALID_ATTENDEE_ROLES = {"required", "optional"}

# When creating a meeting, attendees start as "pending"
# The organizer is auto-marked as "accepted"
DEFAULT_ORGANIZER_RESPONSE = "accepted"


# ============================================================
# HELPERS
# ============================================================

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _notify_attendee(
    db: AsyncSession,
    *,
    attendee_person_id: str,
    meeting: Meeting,
    organizer_name: str,
) -> None:
    """
    Create a notification for one attendee. Best-effort — the meeting
    itself should succeed even if the notification write fails.
    """
    # Find the user account for that person
    user_result = await db.execute(
        select(User).where(User.person_id == attendee_person_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        return

    starts = meeting.starts_at.strftime("%a, %b %d at %H:%M UTC") if meeting.starts_at else "soon"
    notification = Notification(
        id=str(uuid.uuid4()),
        user_id=user.id,
        title="You've been invited to a meeting",
        body=f"{organizer_name} invited you: {meeting.title} — {starts}",
        type="meeting",
        link=f"/meetings/{meeting.id}",
    )
    db.add(notification)


# ============================================================
# CREATE
# ============================================================

async def create_meeting(
    db: AsyncSession,
    *,
    actor: User,
    title: str,
    description: Optional[str],
    starts_at: datetime,
    ends_at: datetime,
    location_type: str,
    location: Optional[str],
    meeting_url: Optional[str],
    attendee_ids: Sequence[str],
    attendee_roles: Optional[dict[str, str]] = None,
    project_id: Optional[str] = None,
    opportunity_id: Optional[str] = None,
    recurrence: Optional[str] = None,
    agenda_titles: Optional[Sequence[str]] = None,
) -> Meeting:
    """
    Create a meeting.

    Validations:
    - actor must have a person record
    - title required
    - ends_at must be after starts_at
    - location_type must be one of in_person / video / phone
    - at least one attendee required
    - all attendees must be existing, non-deleted people
    - project_id and opportunity_id (if set) must exist

    Side effects:
    - Meeting created
    - Attendee rows created (organizer auto-accepted)
    - Notification for each attendee
    - Audit log
    """
    if not actor.person_id:
        raise HTTPException(
            status_code=400,
            detail="Your account is not linked to an employee record",
        )

    organizer_person_id = actor.person_id

    # ---- validate fields ----
    if not title or not title.strip():
        raise HTTPException(400, "Title is required")
    if not starts_at or not ends_at:
        raise HTTPException(400, "Start and end time are required")
    if ends_at <= starts_at:
        raise HTTPException(400, "End time must be after start time")
    if location_type not in VALID_LOCATION_TYPES:
        raise HTTPException(
            400,
            f"location_type must be one of {sorted(VALID_LOCATION_TYPES)}",
        )
    if not attendee_ids:
        raise HTTPException(400, "At least one attendee is required")

    duration_minutes = int((ends_at - starts_at).total_seconds() / 60)

    # ---- validate attendees ----
    attendee_ids = [a for a in attendee_ids if a != organizer_person_id]
    if not attendee_ids:
        raise HTTPException(
            400,
            "Cannot create a meeting with no attendees other than yourself",
        )

    people_result = await db.execute(
        select(Person).where(
            Person.id.in_(attendee_ids),
            Person.deleted_at.is_(None),
        )
    )
    found_people = {p.id for p in people_result.scalars().all()}
    missing = set(attendee_ids) - found_people
    if missing:
        raise HTTPException(
            400,
            f"Attendees not found: {', '.join(sorted(missing))}",
        )

    # ---- validate optional context ----
    if project_id:
        from app.models.sql.projects.project import Project
        r = await db.execute(select(Project).where(Project.id == project_id))
        if not r.scalar_one_or_none():
            raise HTTPException(404, "Project not found")

    if opportunity_id:
        from app.models.sql.crm.opportunity import Opportunity
        r = await db.execute(select(Opportunity).where(Opportunity.id == opportunity_id))
        if not r.scalar_one_or_none():
            raise HTTPException(404, "Opportunity not found")

    # ---- create meeting ----
    meeting = Meeting(
        id=str(uuid.uuid4()),
        title=title.strip(),
        description=description,
        starts_at=starts_at,
        ends_at=ends_at,
        duration_minutes=duration_minutes,
        location_type=location_type,
        location=location,
        meeting_url=meeting_url,
        organizer_id=organizer_person_id,
        status="scheduled",
        recurrence=recurrence,
        project_id=project_id,
        opportunity_id=opportunity_id,
    )
    db.add(meeting)
    await db.flush()

    # ---- organizer as attendee ----
    organizer_attendee = MeetingAttendee(
        id=str(uuid.uuid4()),
        meeting_id=meeting.id,
        person_id=organizer_person_id,
        role="required",
        response=DEFAULT_ORGANIZER_RESPONSE,
        responded_at=_now_utc(),
    )
    db.add(organizer_attendee)

    # ---- other attendees ----
    organizer_result = await db.execute(
        select(Person).where(Person.id == organizer_person_id)
    )
    organizer = organizer_result.scalar_one_or_none()
    organizer_name = (
        f"{organizer.first_name} {organizer.last_name}".strip()
        if organizer
        else "Someone"
    )

    for att_id in attendee_ids:
        role = "required"
        if attendee_roles and att_id in attendee_roles:
            role = attendee_roles[att_id]
        if role not in VALID_ATTENDEE_ROLES:
            role = "required"

        attendee = MeetingAttendee(
            id=str(uuid.uuid4()),
            meeting_id=meeting.id,
            person_id=att_id,
            role=role,
            response="pending",
        )
        db.add(attendee)

        await _notify_attendee(
            db,
            attendee_person_id=att_id,
            meeting=meeting,
            organizer_name=organizer_name,
        )

    # ---- agenda items ----
    if agenda_titles:
        for i, ag_title in enumerate(agenda_titles):
            if not ag_title or not ag_title.strip():
                continue
            db.add(
                MeetingAgendaItem(
                    id=str(uuid.uuid4()),
                    meeting_id=meeting.id,
                    title=ag_title.strip()[:255],
                    position=i,
                )
            )

    # ---- audit ----
    await AuditService.log(
        db=db,
        actor=actor,
        action="MEETING_CREATED",
        entity_type="meeting",
        entity_id=meeting.id,
        description=f"Scheduled meeting: {title}",
        new_values={
            "title": title,
            "starts_at": starts_at.isoformat(),
            "attendee_count": len(attendee_ids),
        },
    )

    return meeting


# ============================================================
# UPDATE
# ============================================================

async def update_meeting(
    db: AsyncSession,
    *,
    actor: User,
    meeting_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    starts_at: Optional[datetime] = None,
    ends_at: Optional[datetime] = None,
    location_type: Optional[str] = None,
    location: Optional[str] = None,
    meeting_url: Optional[str] = None,
    project_id: Optional[str] = None,
    opportunity_id: Optional[str] = None,
) -> Meeting:
    """
    Update meeting fields. Only the organizer can update.

    Changing start/end times resets all attendee responses to pending
    (except organizer, which stays accepted) and re-notifies attendees.
    """
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.attendees).selectinload(MeetingAttendee.person),
            selectinload(Meeting.organizer),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    if meeting.organizer_id != actor.person_id:
        raise HTTPException(403, "Only the organizer can update this meeting")

    if meeting.status == "cancelled":
        raise HTTPException(400, "Cannot update a cancelled meeting")

    changes = {}
    old_values = {}

    # Track time changes to decide whether to reset RSVPs
    time_changed = False

    if title is not None and title.strip() and title.strip() != meeting.title:
        changes["title"] = title.strip()
        old_values["title"] = meeting.title

    if description is not None and description != meeting.description:
        changes["description"] = description
        old_values["description"] = meeting.description

    if starts_at is not None and starts_at != meeting.starts_at:
        changes["starts_at"] = starts_at
        old_values["starts_at"] = meeting.starts_at.isoformat() if meeting.starts_at else None
        time_changed = True

    if ends_at is not None and ends_at != meeting.ends_at:
        changes["ends_at"] = ends_at
        old_values["ends_at"] = meeting.ends_at.isoformat() if meeting.ends_at else None
        time_changed = True

    # Validate after time changes
    new_start = changes.get("starts_at", meeting.starts_at)
    new_end = changes.get("ends_at", meeting.ends_at)
    if new_end <= new_start:
        raise HTTPException(400, "End time must be after start time")

    if time_changed:
        changes["duration_minutes"] = int((new_end - new_start).total_seconds() / 60)

    if location_type is not None:
        if location_type not in VALID_LOCATION_TYPES:
            raise HTTPException(
                400,
                f"location_type must be one of {sorted(VALID_LOCATION_TYPES)}",
            )
        if location_type != meeting.location_type:
            changes["location_type"] = location_type
            old_values["location_type"] = meeting.location_type

    if location is not None and location != meeting.location:
        changes["location"] = location
        old_values["location"] = meeting.location

    if meeting_url is not None and meeting_url != meeting.meeting_url:
        changes["meeting_url"] = meeting_url
        old_values["meeting_url"] = meeting.meeting_url

    if project_id is not None and project_id != meeting.project_id:
        changes["project_id"] = project_id or None
        old_values["project_id"] = str(meeting.project_id) if meeting.project_id else None

    if opportunity_id is not None and opportunity_id != meeting.opportunity_id:
        changes["opportunity_id"] = opportunity_id or None
        old_values["opportunity_id"] = (
            str(meeting.opportunity_id) if meeting.opportunity_id else None
        )

    if not changes:
        raise HTTPException(400, "No changes supplied")

    # Apply
    for k, v in changes.items():
        setattr(meeting, k, v)

    # If time changed, reset non-organizer RSVPs and notify
    if time_changed:
        organizer_name = (
            f"{meeting.organizer.first_name} {meeting.organizer.last_name}".strip()
            if meeting.organizer
            else "Someone"
        )
        for att in meeting.attendees:
            if att.person_id == meeting.organizer_id:
                continue
            att.response = "pending"
            att.responded_at = None
            await _notify_attendee(
                db,
                attendee_person_id=att.person_id,
                meeting=meeting,
                organizer_name=f"{organizer_name} (rescheduled)",
            )

    await AuditService.log(
        db=db,
        actor=actor,
        action="MEETING_UPDATED",
        entity_type="meeting",
        entity_id=meeting.id,
        description=f"Updated meeting: {meeting.title}",
        old_values=old_values,
        new_values={k: str(v) if v is not None else None for k, v in changes.items()},
    )

    return meeting


# ============================================================
# CANCEL
# ============================================================

async def cancel_meeting(
    db: AsyncSession,
    *,
    actor: User,
    meeting_id: str,
    reason: Optional[str] = None,
) -> Meeting:
    """
    Cancel a meeting. Only organizer can cancel. Idempotent-safe:
    cancelling a cancelled meeting is a no-op that raises a friendly error.
    """
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.attendees))
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    if meeting.organizer_id != actor.person_id:
        raise HTTPException(403, "Only the organizer can cancel this meeting")

    if meeting.status == "cancelled":
        raise HTTPException(400, "Meeting is already cancelled")

    meeting.status = "cancelled"
    meeting.cancelled_at = _now_utc()
    meeting.cancelled_by_id = actor.person_id
    meeting.cancellation_reason = reason

    # Notify all attendees
    organizer_result = await db.execute(
        select(Person).where(Person.id == meeting.organizer_id)
    )
    organizer = organizer_result.scalar_one_or_none()
    organizer_name = (
        f"{organizer.first_name} {organizer.last_name}".strip()
        if organizer
        else "Someone"
    )

    for att in meeting.attendees:
        if att.person_id == meeting.organizer_id:
            continue

        user_result = await db.execute(
            select(User).where(User.person_id == att.person_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            continue

        db.add(
            Notification(
                id=str(uuid.uuid4()),
                user_id=user.id,
                title="Meeting cancelled",
                body=(
                    f"{organizer_name} cancelled: {meeting.title}"
                    + (f" — {reason}" if reason else "")
                ),
                type="meeting",
                link=f"/meetings/{meeting.id}",
            )
        )

    await AuditService.log(
        db=db,
        actor=actor,
        action="MEETING_CANCELLED",
        entity_type="meeting",
        entity_id=meeting.id,
        description=f"Cancelled meeting: {meeting.title}",
        new_values={"reason": reason},
    )

    return meeting


# ============================================================
# RSVP
# ============================================================

async def respond_to_meeting(
    db: AsyncSession,
    *,
    actor: User,
    meeting_id: str,
    response: str,
    note: Optional[str] = None,
) -> MeetingAttendee:
    """
    RSVP to a meeting.

    Only attendees on the meeting can RSVP. The organizer's response
    is always "accepted" (they scheduled it).
    """
    if response not in VALID_RESPONSES:
        raise HTTPException(
            400,
            f"response must be one of {sorted(VALID_RESPONSES)}",
        )

    result = await db.execute(
        select(MeetingAttendee).where(
            MeetingAttendee.meeting_id == meeting_id,
            MeetingAttendee.person_id == actor.person_id,
        )
    )
    attendee = result.scalar_one_or_none()
    if not attendee:
        raise HTTPException(404, "You are not an attendee of this meeting")

    if attendee.person_id == actor.person_id:
        # Actually this is the actor — allow
        pass

    meeting_result = await db.execute(
        select(Meeting).where(Meeting.id == meeting_id)
    )
    meeting = meeting_result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    if meeting.status == "cancelled":
        raise HTTPException(400, "Meeting has been cancelled")

    if meeting.organizer_id == actor.person_id:
        raise HTTPException(
            400,
            "You are the organizer and are always marked as accepted",
        )

    previous_response = attendee.response
    attendee.response = response
    attendee.responded_at = _now_utc()
    attendee.response_note = note

    # Let the organizer know when an attendee changes their answer.
    if previous_response != response and meeting.organizer_id != actor.person_id:
        actor_name = (
            f"{actor.person.first_name} {actor.person.last_name}".strip()
            if actor.person
            else "Someone"
        )
        organizer_user_result = await db.execute(
            select(User).where(User.person_id == meeting.organizer_id)
        )
        organizer_user = organizer_user_result.scalar_one_or_none()
        if organizer_user:
            db.add(
                Notification(
                    id=str(uuid.uuid4()),
                    user_id=organizer_user.id,
                    title=f"RSVP: {actor_name} {response}",
                    body=f"{actor_name} responded '{response}' to {meeting.title}",
                    type="meeting",
                    link=f"/meetings/{meeting.id}",
                )
            )

    await AuditService.log(
        db=db,
        actor=actor,
        action="MEETING_RSVP",
        entity_type="meeting_attendee",
        entity_id=attendee.id,
        description=f"RSVP'd '{response}' to {meeting.title}",
        new_values={"response": response},
    )

    return attendee


# ============================================================
# LIST
# ============================================================

async def list_my_meetings(
    db: AsyncSession,
    *,
    actor: User,
    window: str = "upcoming",  # upcoming | today | week | past | all
    limit: int = 100,
    offset: int = 0,
) -> List[Meeting]:
    """
    List meetings where the current user is either organizer or attendee.
    """
    if not actor.person_id:
        raise HTTPException(400, "No linked employee record")

    person_id = actor.person_id
    now = _now_utc()

    # Meeting IDs where the user is a participant
    my_meeting_ids = select(MeetingAttendee.meeting_id).where(
        MeetingAttendee.person_id == person_id
    )

    query = (
        select(Meeting)
        .options(
            selectinload(Meeting.attendees).selectinload(MeetingAttendee.person),
            selectinload(Meeting.organizer),
            selectinload(Meeting.agenda_items),
            selectinload(Meeting.project),
            selectinload(Meeting.opportunity),
        )
        .where(
            or_(
                Meeting.organizer_id == person_id,
                Meeting.id.in_(my_meeting_ids),
            )
        )
    )

    # Apply time window
    if window == "upcoming":
        query = query.where(
            Meeting.starts_at >= now,
            Meeting.status == "scheduled",
        ).order_by(Meeting.starts_at)
    elif window == "today":
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        query = query.where(
            Meeting.starts_at >= start_of_day,
            Meeting.starts_at < end_of_day,
            Meeting.status == "scheduled",
        ).order_by(Meeting.starts_at)
    elif window == "week":
        horizon = now + timedelta(days=7)
        query = query.where(
            Meeting.starts_at >= now,
            Meeting.starts_at <= horizon,
            Meeting.status == "scheduled",
        ).order_by(Meeting.starts_at)
    elif window == "past":
        query = query.where(
            Meeting.starts_at < now,
        ).order_by(desc(Meeting.starts_at))
    else:  # all
        query = query.order_by(desc(Meeting.starts_at))

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_meeting(
    db: AsyncSession,
    *,
    actor: User,
    meeting_id: str,
) -> Meeting:
    """
    Load a single meeting. Only organizer or attendees can view.
    """
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.attendees).selectinload(MeetingAttendee.person),
            selectinload(Meeting.organizer),
            selectinload(Meeting.cancelled_by),
            selectinload(Meeting.agenda_items),
            selectinload(Meeting.project),
            selectinload(Meeting.opportunity),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    person_id = actor.person_id
    is_involved = meeting.organizer_id == person_id or any(
        a.person_id == person_id for a in meeting.attendees
    )
    if not is_involved:
        raise HTTPException(403, "You are not part of this meeting")

    return meeting
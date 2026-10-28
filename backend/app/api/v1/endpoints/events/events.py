from datetime import datetime, time, timedelta, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import Permissions, require_permission
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.user import Person, User
from app.models.sql.events.event import Event, EventAttendee
from app.models.sql.projects.project import Project
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService

router = APIRouter()

EVENT_TYPES = {
    "general",
    "training",
    "workshop",
    "conference",
    "outreach",
    "fundraising",
    "community",
}
ATTENDEE_ROLES = {"attendee", "speaker", "volunteer"}
RSVP_RESPONSES = {"accepted", "declined", "tentative"}


# ============================================================
# SCHEMAS
# ============================================================

class PersonBrief(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    profile_image_url: Optional[str] = None


class AttendeeItem(BaseModel):
    id: str
    person: PersonBrief
    role: str
    response: str
    responded_at: Optional[str] = None
    response_note: Optional[str] = None


class EventSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    event_type: str
    status: str
    starts_at: str
    ends_at: str
    all_day: bool
    location: Optional[str] = None
    is_virtual: bool
    meeting_url: Optional[str] = None
    organiser: PersonBrief
    organisation_id: Optional[str] = None
    organisation_name: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    programme_id: Optional[str] = None
    programme_name: Optional[str] = None
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    attendee_count: int
    my_response: Optional[str] = None
    published_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    cancellation_reason: Optional[str] = None
    created_at: Optional[str] = None


class EventDetail(EventSummary):
    attendees: List[AttendeeItem] = []


class CreateEventRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    event_type: str = Field("general", max_length=50)
    starts_at: datetime
    ends_at: datetime
    all_day: bool = False
    location: Optional[str] = Field(None, max_length=255)
    is_virtual: bool = False
    meeting_url: Optional[str] = None
    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None
    attendee_ids: List[str] = Field(default_factory=list)
    attendee_roles: Optional[dict[str, str]] = None

    @field_validator("event_type")
    @classmethod
    def valid_event_type(cls, value: str) -> str:
        if value not in EVENT_TYPES:
            raise ValueError(f"must be one of {sorted(EVENT_TYPES)}")
        return value

    @model_validator(mode="after")
    def valid_window(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class UpdateEventRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    event_type: Optional[str] = Field(None, max_length=50)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = Field(None, max_length=255)
    is_virtual: Optional[bool] = None
    meeting_url: Optional[str] = None
    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None
    attendee_ids: Optional[List[str]] = None
    attendee_roles: Optional[dict[str, str]] = None

    @field_validator("event_type")
    @classmethod
    def valid_event_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in EVENT_TYPES:
            raise ValueError(f"must be one of {sorted(EVENT_TYPES)}")
        return value


class CancelEventRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)


class AddAttendeesRequest(BaseModel):
    person_ids: List[str] = Field(..., min_length=1)
    role: str = Field("attendee", max_length=30)

    @field_validator("role")
    @classmethod
    def valid_role(cls, value: str) -> str:
        if value not in ATTENDEE_ROLES:
            raise ValueError(f"must be one of {sorted(ATTENDEE_ROLES)}")
        return value


class RsvpRequest(BaseModel):
    response: str = Field(..., max_length=30)
    note: Optional[str] = Field(None, max_length=1000)

    @field_validator("response")
    @classmethod
    def valid_response(cls, value: str) -> str:
        if value not in RSVP_RESPONSES:
            raise ValueError(f"must be one of {sorted(RSVP_RESPONSES)}")
        return value


class RsvpResponse(BaseModel):
    event_id: str
    person_id: str
    response: str
    responded_at: str


# ============================================================
# HELPERS
# ============================================================

def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clean_id(value: Optional[str]) -> Optional[str]:
    return value or None


def _person_brief(person: Optional[Person]) -> PersonBrief:
    if not person:
        return PersonBrief(id="", first_name="Unknown", last_name="")
    return PersonBrief(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        profile_image_url=person.profile_image_url,
    )


def _summary(event: Event, *, actor_person_id: Optional[str]) -> EventSummary:
    my_response = None
    if actor_person_id:
        for attendee in event.attendees or []:
            if attendee.person_id == actor_person_id:
                my_response = attendee.response
                break

    return EventSummary(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        status=event.status,
        starts_at=event.starts_at.isoformat() if event.starts_at else "",
        ends_at=event.ends_at.isoformat() if event.ends_at else "",
        all_day=event.all_day,
        location=event.location,
        is_virtual=event.is_virtual,
        meeting_url=event.meeting_url,
        organiser=_person_brief(event.organiser),
        organisation_id=(
            str(event.organisation_id) if event.organisation_id else None
        ),
        organisation_name=(
            event.organisation.name if event.organisation else None
        ),
        department_id=(
            str(event.department_id) if event.department_id else None
        ),
        department_name=event.department.name if event.department else None,
        programme_id=(
            str(event.programme_id) if event.programme_id else None
        ),
        programme_name=event.programme.name if event.programme else None,
        project_id=str(event.project_id) if event.project_id else None,
        project_name=event.project.name if event.project else None,
        attendee_count=len(event.attendees or []),
        my_response=my_response,
        published_at=_iso(event.published_at),
        cancelled_at=_iso(event.cancelled_at),
        cancellation_reason=event.cancellation_reason,
        created_at=_iso(event.created_at),
    )


def _detail(event: Event, *, actor_person_id: Optional[str]) -> EventDetail:
    summary = _summary(event, actor_person_id=actor_person_id)
    attendees = [
        AttendeeItem(
            id=attendee.id,
            person=_person_brief(attendee.person),
            role=attendee.role,
            response=attendee.response,
            responded_at=_iso(attendee.responded_at),
            response_note=attendee.response_note,
        )
        for attendee in (event.attendees or [])
    ]
    return EventDetail(**summary.model_dump(), attendees=attendees)


async def _reload(db: AsyncSession, event_id: str) -> Event:
    # populates existing instances so attendee changes made in this session
    # are reflected instead of returning the cached collection.
    result = await db.execute(
        select(Event)
        .where(Event.id == event_id)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _require_person(db: AsyncSession, user: User) -> Person:
    if not user.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not linked to a person record.",
        )
    person = await db.get(Person, user.person_id)
    if not person or person.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your person record is not available.",
        )
    return person


async def _ensure_link(
    db: AsyncSession,
    model,
    value: Optional[str],
    label: str,
) -> Optional[str]:
    value = _clean_id(value)
    if not value:
        return None
    result = await db.execute(select(model.id).where(model.id == value))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} not found",
        )
    return value


async def _validate_links(
    db: AsyncSession,
    *,
    organisation_id: Optional[str],
    department_id: Optional[str],
    programme_id: Optional[str],
    project_id: Optional[str],
) -> dict:
    return {
        "organisation_id": await _ensure_link(
            db, Organisation, organisation_id, "Organisation"
        ),
        "department_id": await _ensure_link(
            db, Department, department_id, "Department"
        ),
        "programme_id": await _ensure_link(
            db, Programme, programme_id, "Programme"
        ),
        "project_id": await _ensure_link(
            db, Project, project_id, "Project"
        ),
    }


async def _valid_attendee_ids(
    db: AsyncSession,
    person_ids: Optional[List[str]],
) -> List[str]:
    ids = []
    for raw in person_ids or []:
        value = _clean_id(raw)
        if value and value not in ids:
            ids.append(value)
    if not ids:
        return []

    result = await db.execute(
        select(Person.id).where(
            Person.id.in_(ids),
            Person.deleted_at.is_(None),
        )
    )
    found = {str(row[0]) for row in result}
    missing = [value for value in ids if value not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown person(s): {', '.join(missing)}",
        )
    return ids


def _attendee_role(
    roles: Optional[dict[str, str]],
    person_id: str,
) -> str:
    role = (roles or {}).get(person_id, "attendee")
    if role not in ATTENDEE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid attendee role for {person_id}",
        )
    return role


async def _load_event(db: AsyncSession, event_id: str) -> Event:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return event


async def _can_manage(db: AsyncSession, user: User) -> bool:
    return await PermissionService.has_permission(
        db, user.id, Permissions.EVENTS_EDIT
    )


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=List[EventSummary])
async def list_events(
    window: str = Query(
        "upcoming",
        description="upcoming / today / past / all",
    ),
    event_status: Optional[str] = Query(None, alias="status"),
    event_type: Optional[str] = None,
    organisation_id: Optional[str] = None,
    department_id: Optional[str] = None,
    programme_id: Optional[str] = None,
    project_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_VIEW)
    ),
):
    """List events visible to the current user."""
    if window not in {"upcoming", "today", "past", "all"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="window must be upcoming / today / past / all",
        )

    query = select(Event)

    if not await _can_manage(db, current_user):
        query = query.where(Event.status != "draft")

    if event_status:
        query = query.where(Event.status == event_status)
    if event_type:
        query = query.where(Event.event_type == event_type)
    if organisation_id:
        query = query.where(Event.organisation_id == organisation_id)
    if department_id:
        query = query.where(Event.department_id == department_id)
    if programme_id:
        query = query.where(Event.programme_id == programme_id)
    if project_id:
        query = query.where(Event.project_id == project_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Event.title.ilike(pattern),
                Event.description.ilike(pattern),
                Event.location.ilike(pattern),
            )
        )

    now = datetime.now(timezone.utc)
    if window == "upcoming":
        query = query.where(Event.ends_at >= now).order_by(
            Event.starts_at.asc()
        )
    elif window == "past":
        query = query.where(Event.ends_at < now).order_by(
            Event.starts_at.desc()
        )
    elif window == "today":
        day_start = datetime.combine(
            now.date(), time.min, tzinfo=timezone.utc
        )
        day_end = day_start + timedelta(days=1)
        query = (
            query.where(Event.starts_at >= day_start)
            .where(Event.starts_at < day_end)
            .order_by(Event.starts_at.asc())
        )
    else:
        query = query.order_by(Event.starts_at.desc())

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        _summary(event, actor_person_id=current_user.person_id)
        for event in events
    ]


@router.get("/upcoming", response_model=List[EventSummary])
async def list_upcoming_events(
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_VIEW)
    ),
):
    """Upcoming published events, for dashboards and the sidebar."""
    now = datetime.now(timezone.utc)
    query = (
        select(Event)
        .where(Event.status == "published")
        .where(Event.ends_at >= now)
        .order_by(Event.starts_at.asc())
        .limit(limit)
    )
    result = await db.execute(query)
    events = result.scalars().all()
    return [
        _summary(event, actor_person_id=current_user.person_id)
        for event in events
    ]


# ============================================================
# DETAIL
# ============================================================

@router.get("/{event_id}", response_model=EventDetail)
async def get_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_VIEW)
    ),
):
    """Event detail. Drafts are only visible to event managers."""
    event = await _load_event(db, event_id)

    if event.status == "draft" and not await _can_manage(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return _detail(event, actor_person_id=current_user.person_id)


# ============================================================
# CREATE
# ============================================================

@router.post(
    "",
    response_model=EventDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_event(
    payload: CreateEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_CREATE)
    ),
):
    """Create a draft event. Publishing is a separate step."""
    organiser = await _require_person(db, current_user)

    links = await _validate_links(
        db,
        organisation_id=payload.organisation_id,
        department_id=payload.department_id,
        programme_id=payload.programme_id,
        project_id=payload.project_id,
    )
    attendee_ids = await _valid_attendee_ids(db, payload.attendee_ids)

    event = Event(
        id=str(uuid.uuid4()),
        title=payload.title.strip(),
        description=payload.description,
        event_type=payload.event_type,
        status="draft",
        starts_at=_as_utc(payload.starts_at),
        ends_at=_as_utc(payload.ends_at),
        all_day=payload.all_day,
        location=payload.location,
        is_virtual=payload.is_virtual,
        meeting_url=payload.meeting_url,
        organiser_id=organiser.id,
        **links,
    )
    event.attendees = [
        EventAttendee(
            person_id=person_id,
            role=_attendee_role(payload.attendee_roles, person_id),
        )
        for person_id in attendee_ids
    ]

    db.add(event)
    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="EVENT_CREATED",
        entity_type="event",
        entity_id=event.id,
        description=f"Created event {event.title}",
        new_values={
            "title": event.title,
            "event_type": event.event_type,
            "starts_at": _iso(event.starts_at),
            "ends_at": _iso(event.ends_at),
        },
    )

    await db.commit()
    event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


# ============================================================
# UPDATE
# ============================================================

@router.patch("/{event_id}", response_model=EventDetail)
async def update_event(
    event_id: str,
    payload: UpdateEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_EDIT)
    ),
):
    """Update event details. Publishing and cancelling have their own routes."""
    event = await _load_event(db, event_id)

    changes = payload.model_dump(exclude_unset=True)
    attendee_ids = changes.pop("attendee_ids", None)
    attendee_roles = changes.pop("attendee_roles", None)

    for link in (
        "organisation_id",
        "department_id",
        "programme_id",
        "project_id",
    ):
        if link in changes:
            changes[link] = _clean_id(changes[link])

    if "starts_at" in changes and changes["starts_at"]:
        changes["starts_at"] = _as_utc(changes["starts_at"])
    if "ends_at" in changes and changes["ends_at"]:
        changes["ends_at"] = _as_utc(changes["ends_at"])

    starts_at = changes.get("starts_at", event.starts_at)
    ends_at = changes.get("ends_at", event.ends_at)
    if starts_at and ends_at and _as_utc(ends_at) <= _as_utc(starts_at):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ends_at must be after starts_at",
        )

    if any(
        key in changes
        for key in (
            "organisation_id",
            "department_id",
            "programme_id",
            "project_id",
        )
    ):
        links = await _validate_links(
            db,
            organisation_id=changes.get(
                "organisation_id", event.organisation_id
            ),
            department_id=changes.get(
                "department_id", event.department_id
            ),
            programme_id=changes.get(
                "programme_id", event.programme_id
            ),
            project_id=changes.get("project_id", event.project_id),
        )
        for key, value in links.items():
            if key in changes:
                changes[key] = value

    new_attendee_ids: Optional[List[str]] = None
    if attendee_ids is not None:
        new_attendee_ids = await _valid_attendee_ids(db, attendee_ids)

    old_values = {}
    new_values = {}
    for key, value in changes.items():
        if key == "title" and value:
            value = value.strip()
        old_value = getattr(event, key, None)
        old_values[key] = _iso(old_value) if isinstance(
            old_value, datetime
        ) else (str(old_value) if old_value is not None else None)
        new_values[key] = _iso(value) if isinstance(
            value, datetime
        ) else (str(value) if value is not None else None)
        setattr(event, key, value)

    if new_attendee_ids is not None:
        existing = {
            str(attendee.person_id): attendee
            for attendee in event.attendees
        }
        wanted = set(new_attendee_ids)

        for person_id, attendee in existing.items():
            if person_id not in wanted:
                await db.delete(attendee)

        for person_id in new_attendee_ids:
            if person_id not in existing:
                db.add(
                    EventAttendee(
                        event_id=event.id,
                        person_id=person_id,
                        role=_attendee_role(attendee_roles, person_id),
                    )
                )

    if changes or new_attendee_ids is not None:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="EVENT_UPDATED",
            entity_type="event",
            entity_id=event.id,
            description=f"Updated event {event.title}",
            old_values=old_values,
            new_values=new_values,
        )

    await db.commit()
    event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


# ============================================================
# PUBLISH / CANCEL
# ============================================================

@router.post("/{event_id}/publish", response_model=EventDetail)
async def publish_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_EDIT)
    ),
):
    """Publish a draft event so everyone with events.view can see it."""
    event = await _load_event(db, event_id)

    if event.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cancelled event cannot be published.",
        )

    if event.status == "draft":
        event.status = "published"
        event.published_at = datetime.now(timezone.utc)

        await AuditService.log(
            db=db,
            actor=current_user,
            action="EVENT_PUBLISHED",
            entity_type="event",
            entity_id=event.id,
            description=f"Published event {event.title}",
            new_values={"status": "published"},
        )
        await db.commit()
        event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


@router.post("/{event_id}/cancel", response_model=EventDetail)
async def cancel_event(
    event_id: str,
    payload: CancelEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_EDIT)
    ),
):
    """Cancel an event, keeping the record and reason for history."""
    event = await _load_event(db, event_id)

    if event.status != "cancelled":
        person = await _require_person(db, current_user)
        event.status = "cancelled"
        event.cancelled_at = datetime.now(timezone.utc)
        event.cancelled_by_id = person.id
        event.cancellation_reason = payload.reason

        await AuditService.log(
            db=db,
            actor=current_user,
            action="EVENT_CANCELLED",
            entity_type="event",
            entity_id=event.id,
            description=f"Cancelled event {event.title}",
            new_values={
                "status": "cancelled",
                "reason": payload.reason,
            },
        )
        await db.commit()
        event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


# ============================================================
# ATTENDEES
# ============================================================

@router.post("/{event_id}/attendees", response_model=EventDetail)
async def add_attendees(
    event_id: str,
    payload: AddAttendeesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_EDIT)
    ),
):
    """Add people to an event. Existing attendees are left untouched."""
    event = await _load_event(db, event_id)

    if event.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot add attendees to a cancelled event.",
        )

    person_ids = await _valid_attendee_ids(db, payload.person_ids)
    existing = {str(attendee.person_id) for attendee in event.attendees}

    added = 0
    for person_id in person_ids:
        if person_id in existing:
            continue
        db.add(
            EventAttendee(
                event_id=event.id,
                person_id=person_id,
                role=payload.role,
            )
        )
        added += 1

    if added:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="EVENT_ATTENDEES_ADDED",
            entity_type="event",
            entity_id=event.id,
            description=f"Added {added} attendee(s) to {event.title}",
            new_values={"person_ids": person_ids},
        )
        await db.commit()
        event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


@router.delete(
    "/{event_id}/attendees/{person_id}",
    response_model=EventDetail,
)
async def remove_attendee(
    event_id: str,
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_EDIT)
    ),
):
    """Remove one person from an event."""
    event = await _load_event(db, event_id)

    attendee = next(
        (
            row
            for row in event.attendees
            if str(row.person_id) == person_id
        ),
        None,
    )
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendee not found on this event",
        )

    await db.delete(attendee)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="EVENT_ATTENDEE_REMOVED",
        entity_type="event",
        entity_id=event.id,
        description=f"Removed an attendee from {event.title}",
        old_values={"person_id": person_id},
    )

    await db.commit()
    event = await _reload(db, event.id)

    return _detail(event, actor_person_id=current_user.person_id)


# ============================================================
# RSVP
# ============================================================

@router.post("/{event_id}/rsvp", response_model=RsvpResponse)
async def rsvp_event(
    event_id: str,
    payload: RsvpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.EVENTS_VIEW)
    ),
):
    """Respond to an invitation as the current user."""
    if not current_user.person_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is not linked to a person record.",
        )

    event = await _load_event(db, event_id)

    if event.status != "published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This event is not open for responses.",
        )

    attendee = next(
        (
            row
            for row in event.attendees
            if str(row.person_id) == str(current_user.person_id)
        ),
        None,
    )
    if not attendee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not invited to this event.",
        )

    attendee.response = payload.response
    attendee.response_note = payload.note
    attendee.responded_at = datetime.now(timezone.utc)

    await db.commit()

    return RsvpResponse(
        event_id=event.id,
        person_id=str(current_user.person_id),
        response=attendee.response,
        responded_at=attendee.responded_at.isoformat(),
    )

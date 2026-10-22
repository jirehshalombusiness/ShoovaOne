from datetime import datetime, timezone
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.sql.meeting import Meeting, MeetingAttendee, MeetingAgendaItem
from app.models.sql.user import User, Person
from app.services import meeting_service
from app.services.audit_service import AuditService


router = APIRouter()


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


class AgendaItemResponse(BaseModel):
    id: str
    title: str
    duration_minutes: Optional[int] = None
    position: int
    notes: Optional[str] = None
    completed: bool


class MeetingSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    starts_at: str
    ends_at: str
    duration_minutes: int
    location_type: str
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    organizer: PersonBrief
    status: str
    cancelled_at: Optional[str] = None
    cancellation_reason: Optional[str] = None
    attendee_count: int
    my_response: Optional[str] = None
    project_id: Optional[str] = None
    opportunity_id: Optional[str] = None


class MeetingDetail(MeetingSummary):
    attendees: List[AttendeeItem] = []
    agenda_items: List[AgendaItemResponse] = []


class CreateMeetingRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    location_type: str = Field("video", max_length=30)
    location: Optional[str] = Field(None, max_length=255)
    meeting_url: Optional[str] = None
    attendee_ids: List[str] = Field(default_factory=list)
    attendee_roles: Optional[dict[str, str]] = None
    project_id: Optional[str] = None
    opportunity_id: Optional[str] = None
    recurrence: Optional[str] = Field(None, max_length=30)
    agenda_titles: Optional[List[str]] = None

    @field_validator("location_type")
    @classmethod
    def valid_location(cls, v):
        if v not in {"in_person", "video", "phone"}:
            raise ValueError("must be in_person / video / phone")
        return v


class UpdateMeetingRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    location_type: Optional[str] = Field(None, max_length=30)
    location: Optional[str] = Field(None, max_length=255)
    meeting_url: Optional[str] = None
    project_id: Optional[str] = None
    opportunity_id: Optional[str] = None


class CancelMeetingRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=1000)


class RsvpRequest(BaseModel):
    response: str = Field(..., max_length=30)
    note: Optional[str] = Field(None, max_length=1000)

    @field_validator("response")
    @classmethod
    def valid_response(cls, v):
        if v not in {"accepted", "declined", "tentative"}:
            raise ValueError("must be accepted / declined / tentative")
        return v


# ============================================================
# HELPERS
# ============================================================

def _iso(d) -> Optional[str]:
    if d is None:
        return None
    return d.isoformat()


def _person_brief(p: Optional[Person]) -> PersonBrief:
    if not p:
        return PersonBrief(id="", first_name="Unknown", last_name="")
    return PersonBrief(
        id=p.id,
        first_name=p.first_name,
        last_name=p.last_name,
        email=p.email,
        profile_image_url=p.profile_image_url,
    )


def _summary(m: Meeting, *, actor_person_id: Optional[str]) -> MeetingSummary:
    my_response = None
    if actor_person_id:
        for a in m.attendees:
            if a.person_id == actor_person_id:
                my_response = a.response
                break

    return MeetingSummary(
        id=m.id,
        title=m.title,
        description=m.description,
        starts_at=m.starts_at.isoformat() if m.starts_at else "",
        ends_at=m.ends_at.isoformat() if m.ends_at else "",
        duration_minutes=m.duration_minutes,
        location_type=m.location_type,
        location=m.location,
        meeting_url=m.meeting_url,
        organizer=_person_brief(m.organizer),
        status=m.status,
        cancelled_at=_iso(m.cancelled_at),
        cancellation_reason=m.cancellation_reason,
        attendee_count=len(m.attendees or []),
        my_response=my_response,
        project_id=str(m.project_id) if m.project_id else None,
        opportunity_id=str(m.opportunity_id) if m.opportunity_id else None,
    )


def _detail(m: Meeting, *, actor_person_id: Optional[str]) -> MeetingDetail:
    summary = _summary(m, actor_person_id=actor_person_id)

    attendees = [
        AttendeeItem(
            id=a.id,
            person=_person_brief(a.person),
            role=a.role,
            response=a.response,
            responded_at=_iso(a.responded_at),
            response_note=a.response_note,
        )
        for a in (m.attendees or [])
    ]

    agenda = [
        AgendaItemResponse(
            id=ag.id,
            title=ag.title,
            duration_minutes=ag.duration_minutes,
            position=ag.position,
            notes=ag.notes,
            completed=ag.completed,
        )
        for ag in (m.agenda_items or [])
    ]

    return MeetingDetail(
        **summary.model_dump(),
        attendees=attendees,
        agenda_items=agenda,
    )


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=List[MeetingSummary])
async def list_meetings(
    window: str = Query(
        "upcoming",
        description="upcoming / today / week / past / all",
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List my meetings. Any authenticated user.
    """
    meetings = await meeting_service.list_my_meetings(
        db,
        actor=current_user,
        window=window,
        limit=limit,
        offset=offset,
    )
    return [
        _summary(m, actor_person_id=current_user.person_id) for m in meetings
    ]


@router.get("/upcoming", response_model=List[MeetingSummary])
async def list_upcoming(
    limit: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Next N upcoming meetings. Used by the dashboard widget.
    """
    meetings = await meeting_service.list_my_meetings(
        db,
        actor=current_user,
        window="upcoming",
        limit=limit,
    )
    return [
        _summary(m, actor_person_id=current_user.person_id) for m in meetings
    ]


# ============================================================
# DETAIL
# ============================================================

@router.get("/{meeting_id}", response_model=MeetingDetail)
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting_id
    )
    return _detail(meeting, actor_person_id=current_user.person_id)


# ============================================================
# CREATE
# ============================================================

@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    payload: CreateMeetingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    meeting = await meeting_service.create_meeting(
        db,
        actor=current_user,
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        location_type=payload.location_type,
        location=payload.location,
        meeting_url=payload.meeting_url,
        attendee_ids=payload.attendee_ids,
        attendee_roles=payload.attendee_roles,
        project_id=payload.project_id,
        opportunity_id=payload.opportunity_id,
        recurrence=payload.recurrence,
        agenda_titles=payload.agenda_titles,
    )
    await db.commit()

    # Reload with relationships
    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting.id
    )
    return _detail(meeting, actor_person_id=current_user.person_id)


# ============================================================
# UPDATE
# ============================================================

@router.patch("/{meeting_id}", response_model=MeetingDetail)
async def update_meeting(
    meeting_id: str,
    payload: UpdateMeetingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    meeting = await meeting_service.update_meeting(
        db,
        actor=current_user,
        meeting_id=meeting_id,
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        location_type=payload.location_type,
        location=payload.location,
        meeting_url=payload.meeting_url,
        project_id=payload.project_id,
        opportunity_id=payload.opportunity_id,
    )
    await db.commit()

    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting.id
    )
    return _detail(meeting, actor_person_id=current_user.person_id)


# ============================================================
# CANCEL
# ============================================================

@router.post("/{meeting_id}/cancel", response_model=MeetingDetail)
async def cancel_meeting(
    meeting_id: str,
    payload: CancelMeetingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    meeting = await meeting_service.cancel_meeting(
        db,
        actor=current_user,
        meeting_id=meeting_id,
        reason=payload.reason,
    )
    await db.commit()

    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting.id
    )
    return _detail(meeting, actor_person_id=current_user.person_id)


# ============================================================
# RSVP
# ============================================================

class RsvpResponse(BaseModel):
    attendee_id: str
    person_id: str
    response: str
    responded_at: str


@router.post("/{meeting_id}/rsvp", response_model=RsvpResponse)
async def rsvp_meeting(
    meeting_id: str,
    payload: RsvpRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    attendee = await meeting_service.respond_to_meeting(
        db,
        actor=current_user,
        meeting_id=meeting_id,
        response=payload.response,
        note=payload.note,
    )
    await db.commit()
    await db.refresh(attendee)

    return RsvpResponse(
        attendee_id=attendee.id,
        person_id=attendee.person_id,
        response=attendee.response,
        responded_at=(
            attendee.responded_at.isoformat() if attendee.responded_at else ""
        ),
    )


# ============================================================
# AGENDA
# ============================================================

class AgendaCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    notes: Optional[str] = None


class AgendaUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    duration_minutes: Optional[int] = Field(None, ge=1, le=600)
    notes: Optional[str] = None
    completed: Optional[bool] = None


@router.post(
    "/{meeting_id}/agenda",
    response_model=AgendaItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_agenda_item(
    meeting_id: str,
    payload: AgendaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Add an agenda item. Only the organizer can."""
    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting_id
    )
    if meeting.organizer_id != current_user.person_id:
        raise HTTPException(403, "Only the organizer can edit the agenda")

    # Next position
    next_pos = max((a.position for a in meeting.agenda_items), default=-1) + 1

    item = MeetingAgendaItem(
        id=str(uuid.uuid4()),
        meeting_id=meeting_id,
        title=payload.title.strip(),
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
        position=next_pos,
        completed=False,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return AgendaItemResponse(
        id=item.id,
        title=item.title,
        duration_minutes=item.duration_minutes,
        position=item.position,
        notes=item.notes,
        completed=item.completed,
    )


@router.patch(
    "/{meeting_id}/agenda/{item_id}",
    response_model=AgendaItemResponse,
)
async def update_agenda_item(
    meeting_id: str,
    item_id: str,
    payload: AgendaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update an agenda item. Only the organizer can."""
    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting_id
    )
    if meeting.organizer_id != current_user.person_id:
        raise HTTPException(403, "Only the organizer can edit the agenda")

    result = await db.execute(
        MeetingAgendaItem.__table__.select().where(
            MeetingAgendaItem.id == item_id,
            MeetingAgendaItem.meeting_id == meeting_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Agenda item not found")

    # Load via ORM to update
    item_result = await db.execute(
        MeetingAgendaItem.__table__.select().where(MeetingAgendaItem.id == item_id)
    )
    item = await db.get(MeetingAgendaItem, item_id)
    if not item:
        raise HTTPException(404, "Agenda item not found")

    if payload.title is not None:
        item.title = payload.title.strip()
    if payload.duration_minutes is not None:
        item.duration_minutes = payload.duration_minutes
    if payload.notes is not None:
        item.notes = payload.notes
    if payload.completed is not None:
        item.completed = payload.completed

    await db.commit()
    await db.refresh(item)

    return AgendaItemResponse(
        id=item.id,
        title=item.title,
        duration_minutes=item.duration_minutes,
        position=item.position,
        notes=item.notes,
        completed=item.completed,
    )


@router.delete(
    "/{meeting_id}/agenda/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_agenda_item(
    meeting_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    meeting = await meeting_service.get_meeting(
        db, actor=current_user, meeting_id=meeting_id
    )
    if meeting.organizer_id != current_user.person_id:
        raise HTTPException(403, "Only the organizer can edit the agenda")

    item = await db.get(MeetingAgendaItem, item_id)
    if not item or item.meeting_id != meeting_id:
        raise HTTPException(404, "Agenda item not found")

    await db.delete(item)
    await db.commit()
    return None
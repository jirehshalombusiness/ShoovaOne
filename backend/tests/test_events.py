"""End-to-end checks for the events API using an isolated SQLite database.

The endpoints are called directly so the test exercises the real business
logic and ORM mappings without touching the configured database.
"""

from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401  (register every model)
from app.core.database import Base
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.user import Person, User
from app.models.sql.projects.project import Project
from app.api.v1.endpoints.events import events as events_api


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with factory() as db:
        yield db

    await engine.dispose()


async def seed(db: AsyncSession):
    now = datetime.now(timezone.utc)

    organiser_person = Person(
        first_name="Ama",
        last_name="Mensah",
        email="ama@example.org",
    )
    attendee_person = Person(
        first_name="Kofi",
        last_name="Boateng",
        email="kofi@example.org",
    )
    extra_person = Person(
        first_name="Efua",
        last_name="Owusu",
        email="efua@example.org",
    )
    db.add_all([organiser_person, attendee_person, extra_person])
    await db.flush()

    organiser = User(
        person_id=organiser_person.id,
        email="ama@example.org",
        password_hash="x",
    )
    attendee = User(
        person_id=attendee_person.id,
        email="kofi@example.org",
        password_hash="x",
    )
    db.add_all([organiser, attendee])
    await db.flush()

    ceo_role = Role(name="ceo", description="Chief Executive")
    db.add(ceo_role)
    await db.flush()
    await db.execute(
        user_roles.insert().values(
            user_id=organiser.id,
            role_id=ceo_role.id,
        )
    )

    organisation = Organisation(name="Shoova Foundation")
    db.add(organisation)
    await db.flush()

    department = Department(
        organisation_id=organisation.id,
        name="Programmes",
    )
    db.add(department)
    await db.flush()

    programme = Programme(
        organisation_id=organisation.id,
        department_id=department.id,
        name="Youth Skills",
    )
    project = Project(
        name="Skills Lab",
        organisation_id=organisation.id,
        department_id=department.id,
        programme_id=programme.id,
    )
    db.add_all([programme, project])
    await db.commit()

    return {
        "now": now,
        "organiser": organiser,
        "attendee": attendee,
        "attendee_person": attendee_person,
        "extra_person": extra_person,
        "organisation": organisation,
        "department": department,
        "programme": programme,
        "project": project,
    }


@pytest.mark.asyncio
async def test_event_lifecycle(session: AsyncSession):
    data = await seed(session)
    organiser = data["organiser"]
    attendee = data["attendee"]
    starts = data["now"] + timedelta(days=3)
    ends = starts + timedelta(hours=2)

    created = await events_api.create_event(
        payload=events_api.CreateEventRequest(
            title="Community Outreach Day",
            description="A day of service",
            event_type="outreach",
            starts_at=starts,
            ends_at=ends,
            location="Accra Community Centre",
            organisation_id=data["organisation"].id,
            department_id=data["department"].id,
            programme_id=data["programme"].id,
            project_id=data["project"].id,
            attendee_ids=[data["attendee_person"].id],
        ),
        db=session,
        current_user=organiser,
    )

    assert created.status == "draft"
    assert created.attendee_count == 1
    assert created.organisation_name == "Shoova Foundation"
    assert created.department_name == "Programmes"
    assert created.programme_name == "Youth Skills"
    assert created.project_name == "Skills Lab"
    event_id = created.id

    # Drafts are hidden from regular users.
    visible = await events_api.list_events(
        window="all",
        event_status=None,
        limit=100,
        offset=0,
        db=session,
        current_user=attendee,
    )
    assert [event.id for event in visible] == []

    with pytest.raises(HTTPException) as exc:
        await events_api.get_event(
            event_id=event_id,
            db=session,
            current_user=attendee,
        )
    assert exc.value.status_code == 404

    # The manager can see the draft and publish it.
    draft = await events_api.get_event(
        event_id=event_id,
        db=session,
        current_user=organiser,
    )
    assert draft.status == "draft"

    published = await events_api.publish_event(
        event_id=event_id,
        db=session,
        current_user=organiser,
    )
    assert published.status == "published"
    assert published.published_at

    visible = await events_api.list_events(
        window="upcoming",
        event_status=None,
        limit=100,
        offset=0,
        db=session,
        current_user=attendee,
    )
    assert [event.id for event in visible] == [event_id]
    assert visible[0].my_response == "pending"

    # Attendee RSVP.
    response = await events_api.rsvp_event(
        event_id=event_id,
        payload=events_api.RsvpRequest(response="accepted"),
        db=session,
        current_user=attendee,
    )
    assert response.response == "accepted"

    detail = await events_api.get_event(
        event_id=event_id,
        db=session,
        current_user=attendee,
    )
    assert detail.my_response == "accepted"

    # Adding and removing attendees.
    added = await events_api.add_attendees(
        event_id=event_id,
        payload=events_api.AddAttendeesRequest(
            person_ids=[data["extra_person"].id, data["attendee_person"].id],
        ),
        db=session,
        current_user=organiser,
    )
    assert added.attendee_count == 2

    removed = await events_api.remove_attendee(
        event_id=event_id,
        person_id=data["extra_person"].id,
        db=session,
        current_user=organiser,
    )
    assert removed.attendee_count == 1

    # Cancellation keeps the record and captures the reason.
    cancelled = await events_api.cancel_event(
        event_id=event_id,
        payload=events_api.CancelEventRequest(reason="Venue unavailable"),
        db=session,
        current_user=organiser,
    )
    assert cancelled.status == "cancelled"
    assert cancelled.cancellation_reason == "Venue unavailable"

    with pytest.raises(HTTPException) as exc:
        await events_api.rsvp_event(
            event_id=event_id,
            payload=events_api.RsvpRequest(response="declined"),
            db=session,
            current_user=attendee,
        )
    assert exc.value.status_code == 409

    # Upcoming list excludes the cancelled event from being actionable but
    # still returns it so the UI can show the cancellation.
    upcoming = await events_api.list_events(
        window="upcoming",
        event_status=None,
        limit=100,
        offset=0,
        db=session,
        current_user=attendee,
    )
    assert [event.id for event in upcoming] == [event_id]
    assert upcoming[0].status == "cancelled"


@pytest.mark.asyncio
async def test_event_rejects_invalid_attendee(session: AsyncSession):
    data = await seed(session)
    starts = data["now"] + timedelta(days=1)

    with pytest.raises(HTTPException) as exc:
        await events_api.create_event(
            payload=events_api.CreateEventRequest(
                title="Bad invite",
                starts_at=starts,
                ends_at=starts + timedelta(hours=1),
                attendee_ids=["00000000-0000-0000-0000-000000000000"],
            ),
            db=session,
            current_user=data["organiser"],
        )
    assert exc.value.status_code == 400

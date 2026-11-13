from datetime import date, timedelta

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401
from app.core.database import Base
from app.models.sql.core.organisation import Organisation, Programme
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import ProgrammeCohort
from app.models.sql.programmes.public_application import ProgrammeApplication
from app.api.v1.endpoints.programmes import applications as api


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


async def seed_inbox(db: AsyncSession):
    organisation = Organisation(name="Shoova Academy")
    db.add(organisation)
    await db.flush()

    programme = Programme(
        organisation_id=organisation.id,
        name="Cisco",
        status="active",
    )
    db.add(programme)
    await db.flush()

    today = date.today()
    cohort = ProgrammeCohort(
        programme_id=programme.id,
        name="December Intake",
        start_date=today + timedelta(days=11),
        end_date=today + timedelta(days=150),
        enrolment_opens_on=today,
        enrolment_closes_on=today + timedelta(days=120),
        status="enrolling",
    )
    db.add(cohort)
    await db.flush()

    application = ProgrammeApplication(
        reference="SH-2026-AAAA1111",
        programme_id=programme.id,
        cohort_id=cohort.id,
        applicant_name="Ama Mensah",
        applicant_email="ama.mensah@example.org",
        applicant_phone="+233 20 000 0000",
        motivation="I want to learn practical networking skills.",
    )
    db.add(application)

    person = Person(
        first_name="Ada",
        last_name="Admin",
        email="admin@shoova.org",
    )
    db.add(person)
    await db.flush()
    reviewer = User(
        person_id=person.id,
        email="admin@shoova.org",
        password_hash="not-used-in-tests",
        is_active=True,
    )
    db.add(reviewer)

    await db.commit()
    return programme, cohort, application, reviewer


@pytest.mark.asyncio
async def test_inbox_lists_applications_with_programme_and_cohort_names(
    session: AsyncSession,
):
    programme, cohort, application, _ = await seed_inbox(session)

    items = await api.list_programme_applications(
        programme_id=programme.id,
        status_filter=None,
        cohort_id=None,
        limit=200,
        db=session,
        current_user=None,
    )

    assert len(items) == 1
    item = items[0]
    assert item.reference == "SH-2026-AAAA1111"
    assert item.programme_name == programme.name
    assert item.cohort_name == cohort.name
    assert item.applicant_email == "ama.mensah@example.org"
    assert item.applicant_phone == "+233 20 000 0000"
    assert item.status == "submitted"
    assert item.submitted_at is not None


@pytest.mark.asyncio
async def test_inbox_filters_by_status_and_rejects_unknown_status(
    session: AsyncSession,
):
    programme, _, application, _ = await seed_inbox(session)
    application.status = "accepted"
    await session.commit()

    accepted = await api.list_programme_applications(
        programme_id=programme.id,
        status_filter="accepted",
        cohort_id=None,
        limit=200,
        db=session,
        current_user=None,
    )
    submitted = await api.list_programme_applications(
        programme_id=programme.id,
        status_filter="submitted",
        cohort_id=None,
        limit=200,
        db=session,
        current_user=None,
    )

    assert [item.id for item in accepted] == [application.id]
    assert submitted == []

    with pytest.raises(HTTPException) as exc:
        await api.list_programme_applications(
            programme_id=programme.id,
            status_filter="maybe",
            cohort_id=None,
            limit=200,
            db=session,
            current_user=None,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_review_moves_application_through_the_workflow(
    session: AsyncSession,
):
    programme, _, application, reviewer = await seed_inbox(session)

    reviewed = await api.review_programme_application(
        programme_id=programme.id,
        application_id=application.id,
        payload=api.ApplicationStatusRequest(status="in_review"),
        db=session,
        current_user=reviewer,
    )
    assert reviewed.status == "in_review"

    accepted = await api.review_programme_application(
        programme_id=programme.id,
        application_id=application.id,
        payload=api.ApplicationStatusRequest(status="accepted"),
        db=session,
        current_user=reviewer,
    )
    assert accepted.status == "accepted"
    assert accepted.cohort_name == "December Intake"

    reopened = await api.review_programme_application(
        programme_id=programme.id,
        application_id=application.id,
        payload=api.ApplicationStatusRequest(status="in_review"),
        db=session,
        current_user=reviewer,
    )
    assert reopened.status == "in_review"


@pytest.mark.asyncio
async def test_review_rejects_invalid_transition(session: AsyncSession):
    programme, _, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.review_programme_application(
            programme_id=programme.id,
            application_id=application.id,
            payload=api.ApplicationStatusRequest(status="submitted"),
            db=session,
            current_user=reviewer,
        )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_application_from_another_programme_is_not_found(
    session: AsyncSession,
):
    programme, _, application, reviewer = await seed_inbox(session)
    other = Programme(
        organisation_id=programme.organisation_id,
        name="Other Programme",
        status="active",
    )
    session.add(other)
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.review_programme_application(
            programme_id=other.id,
            application_id=application.id,
            payload=api.ApplicationStatusRequest(status="accepted"),
            db=session,
            current_user=reviewer,
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_review_writes_an_audit_entry(session: AsyncSession):
    programme, _, application, reviewer = await seed_inbox(session)

    await api.review_programme_application(
        programme_id=programme.id,
        application_id=application.id,
        payload=api.ApplicationStatusRequest(status="declined"),
        db=session,
        current_user=reviewer,
    )

    from app.models.sql.core.audit_log import AuditLog

    entry = (
        await session.execute(
            select(AuditLog).where(
                AuditLog.action == "PROGRAMME_APPLICATION_STATUS_CHANGED"
            )
        )
    ).scalar_one()
    assert entry.entity_id == application.id

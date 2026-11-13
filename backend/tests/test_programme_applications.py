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
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
)
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


@pytest.mark.asyncio
async def test_enrol_creates_learner_and_cohort_placement(
    session: AsyncSession,
):
    programme, cohort, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    await session.commit()

    reviewed = await api.enrol_accepted_application(
        programme_id=programme.id,
        application_id=application.id,
        db=session,
        current_user=reviewer,
    )

    assert reviewed.status == "enrolled"

    person = (
        await session.execute(
            select(Person).where(Person.email == "ama.mensah@example.org")
        )
    ).scalar_one()
    assert person.first_name == "Ama"
    assert person.last_name == "Mensah"
    assert person.phone == "+233 20 000 0000"
    assert person.type == "learner"

    enrolment = (
        await session.execute(
            select(CohortEnrolment).where(
                CohortEnrolment.cohort_id == cohort.id,
                CohortEnrolment.person_id == person.id,
            )
        )
    ).scalar_one()
    assert enrolment.status == "enrolled"
    assert enrolment.enrolled_on is not None

    with pytest.raises(HTTPException) as exc:
        await api.enrol_accepted_application(
            programme_id=programme.id,
            application_id=application.id,
            db=session,
            current_user=reviewer,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_enrol_reuses_an_existing_person_with_the_same_email(
    session: AsyncSession,
):
    programme, cohort, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    existing = Person(
        first_name="Ama",
        last_name="Mensah",
        email="AMA.MENSAH@example.org",
        type="volunteer",
    )
    session.add(existing)
    await session.commit()

    await api.enrol_accepted_application(
        programme_id=programme.id,
        application_id=application.id,
        db=session,
        current_user=reviewer,
    )

    people = (
        await session.execute(
            select(Person).where(
                Person.email.in_(
                    ("ama.mensah@example.org", "AMA.MENSAH@example.org")
                )
            )
        )
    ).scalars().all()
    enrolment = (
        await session.execute(
            select(CohortEnrolment).where(
                CohortEnrolment.cohort_id == cohort.id
            )
        )
    ).scalar_one()

    assert len(people) == 1
    assert enrolment.person_id == existing.id
    assert existing.type == "volunteer"


@pytest.mark.asyncio
async def test_enrol_requires_an_accepted_application(session: AsyncSession):
    programme, _, application, reviewer = await seed_inbox(session)

    with pytest.raises(HTTPException) as exc:
        await api.enrol_accepted_application(
            programme_id=programme.id,
            application_id=application.id,
            db=session,
            current_user=reviewer,
        )

    assert exc.value.status_code == 409
    assert (
        await session.execute(select(CohortEnrolment))
    ).scalars().all() == []


@pytest.mark.asyncio
async def test_enrol_rejects_an_existing_active_placement(
    session: AsyncSession,
):
    programme, cohort, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    person = Person(
        first_name="Ama",
        last_name="Mensah",
        email="ama.mensah@example.org",
    )
    session.add(person)
    await session.flush()
    session.add(
        CohortEnrolment(
            cohort_id=cohort.id,
            person_id=person.id,
            status="enrolled",
            enrolled_on=date.today(),
        )
    )
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.enrol_accepted_application(
            programme_id=programme.id,
            application_id=application.id,
            db=session,
            current_user=reviewer,
        )

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_enrol_respects_cohort_capacity(session: AsyncSession):
    programme, cohort, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    cohort.capacity = 0
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.enrol_accepted_application(
            programme_id=programme.id,
            application_id=application.id,
            db=session,
            current_user=reviewer,
        )

    assert exc.value.status_code == 409
    assert "capacity" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_enrol_reactivates_a_withdrawn_placement(
    session: AsyncSession,
):
    programme, cohort, application, reviewer = await seed_inbox(session)
    application.status = "accepted"
    person = Person(
        first_name="Ama",
        last_name="Mensah",
        email="ama.mensah@example.org",
    )
    session.add(person)
    await session.flush()
    session.add(
        CohortEnrolment(
            cohort_id=cohort.id,
            person_id=person.id,
            status="withdrawn",
        )
    )
    await session.commit()

    reviewed = await api.enrol_accepted_application(
        programme_id=programme.id,
        application_id=application.id,
        db=session,
        current_user=reviewer,
    )

    enrolment = (
        await session.execute(
            select(CohortEnrolment).where(
                CohortEnrolment.cohort_id == cohort.id
            )
        )
    ).scalar_one()

    assert reviewed.status == "enrolled"
    assert enrolment.status == "enrolled"
    assert enrolment.enrolled_on is not None

import asyncio
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
from starlette.requests import Request

import app.models.sql  # noqa: F401
from app.core.database import Base
from app.models.sql.core.email_outbox import EmailOutbox
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.role import Permission, Role, role_permissions, user_roles
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
)
from app.models.sql.programmes.public_application import ProgrammeApplication
from app.api.v1.endpoints.programmes import public_programmes as api
from app.services.core import email_service


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


async def seed_open_programme(db: AsyncSession):
    organisation = Organisation(name="Shoova Academy")
    db.add(organisation)
    await db.flush()

    department = Department(
        organisation_id=organisation.id,
        name="Community Learning",
    )
    db.add(department)
    await db.flush()

    programme = Programme(
        organisation_id=organisation.id,
        department_id=department.id,
        name="Community Skills",
        status="active",
        description="A practical community programme.",
        learning_outcomes="Plan and deliver a community project.",
        eligibility_requirements="Applicants must be available weekly.",
    )
    db.add(programme)
    await db.flush()

    today = date.today()
    cohort = ProgrammeCohort(
        programme_id=programme.id,
        name="November Intake",
        code="NOV-1",
        start_date=today + timedelta(days=14),
        end_date=today + timedelta(days=60),
        enrolment_opens_on=today - timedelta(days=7),
        enrolment_closes_on=today + timedelta(days=7),
        delivery_mode="hybrid",
        location="Accra",
        capacity=10,
        status="enrolling",
    )
    db.add(cohort)
    await db.commit()
    return programme, cohort


def request_from(ip: str) -> Request:
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/programmes/public/test/applications",
            "raw_path": b"/api/v1/programmes/public/test/applications",
            "query_string": b"",
            "headers": [],
            "client": (ip, 12345),
            "server": ("test", 80),
        }
    )


@pytest.mark.asyncio
async def test_public_listing_only_returns_open_cohorts_and_public_fields(
    session: AsyncSession,
):
    programme, cohort = await seed_open_programme(session)
    today = date.today()

    closed_cohort = ProgrammeCohort(
        programme_id=programme.id,
        name="Closed Intake",
        enrolment_closes_on=today - timedelta(days=1),
        status="enrolling",
    )
    draft_programme = Programme(
        organisation_id=programme.organisation_id,
        name="Draft Programme",
        status="draft",
    )
    session.add_all([closed_cohort, draft_programme])
    await session.flush()
    session.add(
        ProgrammeCohort(
            programme_id=draft_programme.id,
            name="Draft Intake",
            status="enrolling",
        )
    )
    await session.commit()

    result = await api.list_open_programmes(db=session)

    assert len(result) == 1
    assert result[0].id == programme.id
    assert result[0].eligibility_requirements == (
        "Applicants must be available weekly."
    )
    assert [item.id for item in result[0].cohorts] == [cohort.id]
    assert not hasattr(result[0].cohorts[0], "enrolled_count")
    assert not hasattr(result[0], "lead")


@pytest.mark.asyncio
async def test_public_application_is_saved_without_creating_a_student_account(
    session: AsyncSession,
):
    programme, cohort = await seed_open_programme(session)
    client_ip = "198.51.100.11"
    await api.application_limiter.reset(
        f"programme-application:{client_ip}"
    )
    payload = api.PublicApplicationRequest(
        full_name="  Ama Mensah ",
        email="Ama.Mensah@example.org",
        phone=" ",
        cohort_id=cohort.id,
        motivation="I want to learn practical skills and serve my community.",
    )

    receipt = await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request_from(client_ip),
        db=session,
    )

    application = (
        await session.execute(select(ProgrammeApplication))
    ).scalar_one()
    enrolments = (
        await session.execute(select(CohortEnrolment))
    ).scalars().all()

    assert receipt.reference.startswith(f"SH-{date.today().year}-")
    assert receipt.programme_name == programme.name
    assert receipt.cohort_name == cohort.name
    assert application.applicant_name == "Ama Mensah"
    assert application.applicant_email == "ama.mensah@example.org"
    assert application.applicant_phone is None
    assert application.status == "submitted"
    assert enrolments == []
    assert not hasattr(receipt, "applicant_email")


@pytest.mark.asyncio
async def test_duplicate_application_is_answered_generically(
    session: AsyncSession,
):
    programme, cohort = await seed_open_programme(session)
    client_ip = "198.51.100.12"
    await api.application_limiter.reset(
        f"programme-application:{client_ip}"
    )
    payload = api.PublicApplicationRequest(
        full_name="Ama Mensah",
        email="ama.mensah@example.org",
        cohort_id=cohort.id,
        motivation="I want to learn practical skills and serve my community.",
    )
    request = request_from(client_ip)

    first = await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request,
        db=session,
    )
    second = await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request,
        db=session,
    )

    stored = (
        await session.execute(select(ProgrammeApplication))
    ).scalars().all()
    assert len(stored) == 1
    assert stored[0].reference == first.reference
    assert second.reference != first.reference
    assert second.programme_name == programme.name
    assert second.cohort_name == cohort.name


async def seed_application_editors(db: AsyncSession) -> User:
    permission = Permission(resource="programmes", action="edit")
    db.add(permission)
    await db.flush()

    role = Role(name="Programme Manager")
    db.add(role)
    await db.flush()
    await db.execute(
        role_permissions.insert().values(
            role_id=role.id,
            permission_id=permission.id,
        )
    )

    person = Person(
        first_name="Kojo",
        last_name="Manager",
        email="kojo.manager@example.org",
    )
    db.add(person)
    await db.flush()

    user = User(
        person_id=person.id,
        email="kojo.manager@example.org",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.execute(
        user_roles.insert().values(user_id=user.id, role_id=role.id)
    )
    return user


@pytest.mark.asyncio
async def test_new_application_emails_programme_lead_and_editors(
    session: AsyncSession,
    monkeypatch,
):
    monkeypatch.setattr(
        email_service.settings, "EMAIL_TEST_REDIRECT_TO", "", raising=False
    )
    programme, cohort = await seed_open_programme(session)
    await seed_application_editors(session)

    lead = Person(
        first_name="Adwoa",
        last_name="Lead",
        email="adwoa.lead@example.org",
    )
    session.add(lead)
    await session.flush()
    programme.lead = lead
    await session.commit()

    client_ip = "198.51.100.31"
    await api.application_limiter.reset(f"programme-application:{client_ip}")
    await api.submit_public_application(
        programme_id=programme.id,
        payload=api.PublicApplicationRequest(
            full_name="Ama Mensah",
            email="ama.mensah@example.org",
            cohort_id=cohort.id,
            motivation="I want to learn practical skills and serve my community.",
        ),
        request=request_from(client_ip),
        db=session,
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    rows = list(
        (
            await session.execute(
                select(EmailOutbox).order_by(EmailOutbox.created_at)
            )
        ).scalars().all()
    )
    staff = [row for row in rows if row.to_address != "ama.mensah@example.org"]
    receipt = [
        row for row in rows if row.to_address == "ama.mensah@example.org"
    ]

    assert {row.to_address for row in staff} == {
        "adwoa.lead@example.org",
        "kojo.manager@example.org",
    }
    assert all("Ama Mensah" in row.subject for row in staff)
    assert all("ama.mensah@example.org" in row.html for row in staff)
    assert f"/programmes/{programme.id}/applications" in staff[0].html

    assert len(receipt) == 1
    assert "We received your application" in receipt[0].subject
    assert "SH-" in receipt[0].html


@pytest.mark.asyncio
async def test_new_application_without_audience_sends_nothing(
    session: AsyncSession,
    monkeypatch,
):
    monkeypatch.setattr(
        email_service.settings, "EMAIL_TEST_REDIRECT_TO", "", raising=False
    )
    programme, cohort = await seed_open_programme(session)

    client_ip = "198.51.100.32"
    await api.application_limiter.reset(f"programme-application:{client_ip}")
    await api.submit_public_application(
        programme_id=programme.id,
        payload=api.PublicApplicationRequest(
            full_name="Ama Mensah",
            email="ama.mensah@example.org",
            cohort_id=cohort.id,
            motivation="I want to learn practical skills and serve my community.",
        ),
        request=request_from(client_ip),
        db=session,
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)

    rows = list(
        (await session.execute(select(EmailOutbox))).scalars().all()
    )
    assert [row.to_address for row in rows] == ["ama.mensah@example.org"]


@pytest.mark.asyncio
async def test_rejected_duplicate_does_not_notify_again(
    session: AsyncSession,
    monkeypatch,
):
    monkeypatch.setattr(
        email_service.settings, "EMAIL_TEST_REDIRECT_TO", "", raising=False
    )
    programme, cohort = await seed_open_programme(session)
    await seed_application_editors(session)

    client_ip = "198.51.100.33"
    await api.application_limiter.reset(f"programme-application:{client_ip}")
    payload = api.PublicApplicationRequest(
        full_name="Ama Mensah",
        email="ama.mensah@example.org",
        cohort_id=cohort.id,
        motivation="I want to learn practical skills and serve my community.",
    )
    request = request_from(client_ip)
    await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request,
        db=session,
    )
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    first_batch = len(
        (await session.execute(select(EmailOutbox))).scalars().all()
    )
    assert first_batch == 2  # applicant receipt + programme editor

    second = await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request,
        db=session,
    )
    await asyncio.sleep(0)

    assert second.reference
    assert (
        len((await session.execute(select(EmailOutbox))).scalars().all())
        == first_batch
    )


@pytest.mark.asyncio
async def test_outbox_retries_a_failed_send_then_succeeds(
    session: AsyncSession,
    monkeypatch,
):
    calls: list[dict] = []

    async def flaky(payload):
        calls.append(payload)
        if len(calls) == 1:
            return "failed", "resend 500"
        return "sent", None

    monkeypatch.setattr(email_service, "_send", flaky)

    email_service.queue_email(
        session,
        to="someone@example.org",
        subject="Hello",
        html="<p>Hello</p>",
    )
    await session.commit()

    row = (await session.execute(select(EmailOutbox))).scalars().one()
    assert row.status == "pending"

    assert await email_service.drain_outbox_rows(session) == 0
    await session.refresh(row)
    assert row.status == "pending"
    assert row.attempts == 1
    assert row.next_attempt_at is not None

    row.next_attempt_at = None
    await session.commit()

    assert await email_service.drain_outbox_rows(session) == 1
    await session.refresh(row)
    assert row.status == "sent"
    assert row.sent_at is not None
    assert row.last_error is None


@pytest.mark.asyncio
async def test_outbox_holds_mail_when_email_is_disabled(
    session: AsyncSession,
    monkeypatch,
):
    async def skipped(payload):
        return "skipped", "RESEND_API_KEY not configured"

    monkeypatch.setattr(email_service, "_send", skipped)

    email_service.queue_email(
        session,
        to="someone@example.org",
        subject="Hello",
        html="<p>Hello</p>",
    )
    await session.commit()

    assert await email_service.drain_outbox_rows(session) == 0
    row = (await session.execute(select(EmailOutbox))).scalars().one()
    assert row.status == "pending"
    assert row.attempts == 0
    assert row.last_error == "RESEND_API_KEY not configured"
    assert row.next_attempt_at is not None


def test_client_ip_ignores_client_supplied_forwarded_values():
    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [
                (b"x-forwarded-for", b"10.0.0.9, 198.51.100.7"),
            ],
            "client": ("192.0.2.1", 12345),
            "server": ("test", 80),
        }
    )

    assert api._client_ip(request) == "198.51.100.7"


@pytest.mark.asyncio
async def test_application_email_daily_cap_blocks_abuse(
    session: AsyncSession,
    monkeypatch,
):
    programme, cohort = await seed_open_programme(session)
    monkeypatch.setattr(api, "APPLICATION_EMAIL_LIMIT", 0)
    client_ip = "198.51.100.44"
    await api.application_limiter.reset(f"programme-application:{client_ip}")

    with pytest.raises(HTTPException) as exc:
        await api.submit_public_application(
            programme_id=programme.id,
            payload=api.PublicApplicationRequest(
                full_name="Ama Mensah",
                email="ama.mensah@example.org",
                cohort_id=cohort.id,
                motivation=(
                    "I want to learn practical skills and serve my community."
                ),
            ),
            request=request_from(client_ip),
            db=session,
        )

    assert exc.value.status_code == 429
    assert (
        await session.execute(select(ProgrammeApplication))
    ).scalars().all() == []

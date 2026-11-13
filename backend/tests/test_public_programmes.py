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
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
)
from app.models.sql.programmes.public_application import ProgrammeApplication
from app.api.v1.endpoints.programmes import public_programmes as api


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
async def test_duplicate_application_for_same_cohort_is_rejected(
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

    await api.submit_public_application(
        programme_id=programme.id,
        payload=payload,
        request=request,
        db=session,
    )

    with pytest.raises(HTTPException) as exc:
        await api.submit_public_application(
            programme_id=programme.id,
            payload=payload,
            request=request,
            db=session,
        )

    assert exc.value.status_code == 409

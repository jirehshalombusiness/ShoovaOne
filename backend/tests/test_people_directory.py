import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401
from app.core.database import Base
from app.models.sql.core.organisation import Organisation, Programme
from app.models.sql.core.user import Person
from app.models.sql.programmes.academics import CohortEnrolment, ProgrammeCohort
from app.api.v1.endpoints.core.people import get_people_directory


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with factory() as db:
        yield db
    await engine.dispose()


@pytest.mark.asyncio
async def test_directory_groups_people_and_uses_enrolment_for_students(
    session: AsyncSession,
):
    organisation = Organisation(name="Shoova")
    session.add(organisation)
    await session.flush()
    programme = Programme(organisation_id=organisation.id, name="Skills")
    session.add(programme)
    await session.flush()
    cohort = ProgrammeCohort(programme_id=programme.id, name="2026 Intake")
    session.add(cohort)

    staff = Person(first_name="Ama", last_name="Staff", type="staff")
    partner = Person(
        first_name="Kofi",
        last_name="Partner",
        type="external_contact",
        organization="Partner Org",
    )
    volunteer = Person(first_name="Efua", last_name="Volunteer", type="volunteer")
    student = Person(first_name="Yaw", last_name="Learner", type="beneficiary")
    other = Person(first_name="Abena", last_name="Beneficiary", type="beneficiary")
    session.add_all([staff, partner, volunteer, student, other])
    await session.flush()
    session.add(
        CohortEnrolment(cohort_id=cohort.id, person_id=student.id, status="enrolled")
    )
    await session.commit()

    response = await get_people_directory(
        category="all",
        offset=0,
        limit=25,
        search=None,
        person_status=None,
        country_code=None,
        db=session,
        current_user=None,
    )

    assert response.total == 5
    assert response.counts.model_dump() == {
        "all": 5,
        "staff": 1,
        "partners": 1,
        "volunteers": 1,
        "students": 1,
        "other": 1,
    }
    people_by_id = {person.id: person for person in response.items}
    assert people_by_id[student.id].is_student is True
    assert people_by_id[other.id].is_student is False


@pytest.mark.asyncio
async def test_directory_category_search_and_pagination_are_server_side(
    session: AsyncSession,
):
    session.add_all(
        [
            Person(first_name="Ama", last_name="Mensah", type="staff"),
            Person(
                first_name="Kofi",
                last_name="Boateng",
                type="external_contact",
                organization="Learning Partner",
                phone="+2330001",
            ),
            Person(first_name="Efua", last_name="Owusu", type="volunteer"),
        ]
    )
    await session.commit()

    partners = await get_people_directory(
        category="partners",
        offset=0,
        limit=1,
        search="learning partner",
        person_status=None,
        country_code=None,
        db=session,
        current_user=None,
    )
    staff_page = await get_people_directory(
        category="staff",
        offset=0,
        limit=1,
        search=None,
        person_status=None,
        country_code=None,
        db=session,
        current_user=None,
    )

    assert partners.total == 1
    assert len(partners.items) == 1
    assert partners.items[0].organization == "Learning Partner"
    assert staff_page.total == 1
    assert staff_page.items[0].type == "staff"

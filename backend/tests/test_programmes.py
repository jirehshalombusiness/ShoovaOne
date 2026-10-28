"""End-to-end checks for the academic programmes API on an isolated SQLite DB.

Endpoints are invoked directly so the tests exercise the real business logic,
ORM mappings and audit writes without touching the configured database.
"""

from datetime import date, timedelta

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
from app.api.v1.endpoints.programmes import programmes as api


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
    manager_person = Person(
        first_name="Ama", last_name="Mensah", email="ama@example.org"
    )
    learner_person = Person(
        first_name="Kofi", last_name="Boateng", email="kofi@example.org"
    )
    extra_person = Person(
        first_name="Efua", last_name="Owusu", email="efua@example.org"
    )
    viewer_person = Person(
        first_name="Yaw", last_name="Asare", email="yaw@example.org"
    )
    db.add_all([manager_person, learner_person, extra_person, viewer_person])
    await db.flush()

    manager = User(
        person_id=manager_person.id,
        email="ama@example.org",
        password_hash="x",
    )
    viewer = User(
        person_id=viewer_person.id,
        email="yaw@example.org",
        password_hash="x",
    )
    db.add_all([manager, viewer])
    await db.flush()

    ceo_role = Role(name="ceo", description="Chief Executive")
    db.add(ceo_role)
    await db.flush()
    await db.execute(
        user_roles.insert().values(
            user_id=manager.id, role_id=ceo_role.id
        )
    )

    organisation = Organisation(name="Shoova Academy")
    db.add(organisation)
    await db.flush()

    department = Department(
        organisation_id=organisation.id, name="Academics"
    )
    db.add(department)
    await db.flush()

    # An existing programme seeded outside the module keeps status="active".
    legacy = Programme(
        organisation_id=organisation.id,
        department_id=department.id,
        name="Legacy Skills",
    )
    db.add(legacy)
    await db.commit()

    return {
        "manager": manager,
        "manager_person": manager_person,
        "viewer": viewer,
        "learner_person": learner_person,
        "extra_person": extra_person,
        "organisation": organisation,
        "department": department,
        "legacy": legacy,
    }


@pytest.mark.asyncio
async def test_programme_lifecycle(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]
    viewer = data["viewer"]

    created = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="BSc Computer Science",
            code="BSC-CS",
            description="Four-year undergraduate degree",
            organisation_id=data["organisation"].id,
            department_id=data["department"].id,
            level="degree",
            duration_weeks=52,
            learning_outcomes="Design and ship software",
            lead_id=data["manager_person"].id,
            start_date=date(2026, 9, 1),
            end_date=date(2030, 6, 30),
        ),
        db=session,
        current_user=manager,
    )

    assert created.status == "draft"
    assert created.code == "BSC-CS"
    assert created.organisation_name == "Shoova Academy"
    assert created.department_name == "Academics"
    assert created.lead and created.lead.id == data["manager_person"].id
    assert created.course_count == 0
    programme_id = created.id

    # Duplicate code in the same organisation is rejected.
    with pytest.raises(HTTPException) as exc:
        await api.create_programme(
            payload=api.ProgrammeCreateRequest(
                name="Duplicate",
                code="BSC-CS",
                organisation_id=data["organisation"].id,
            ),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Drafts stay hidden from users who cannot manage programmes.
    viewer_list = await api.list_programmes(
        status_filter=None,
        level=None,
        department_id=None,
        organisation_id=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=viewer,
    )
    assert [item.id for item in viewer_list] == [data["legacy"].id]

    with pytest.raises(HTTPException) as exc:
        await api.get_programme(
            programme_id=programme_id,
            db=session,
            current_user=viewer,
        )
    assert exc.value.status_code == 404

    # Curriculum: two courses get sequential positions.
    detail = await api.add_course(
        programme_id=programme_id,
        payload=api.CourseCreateRequest(
            code="CS101", title="Intro to Programming", contact_hours=60
        ),
        db=session,
        current_user=manager,
    )
    assert [course.sequence for course in detail.courses] == [1]

    detail = await api.add_course(
        programme_id=programme_id,
        payload=api.CourseCreateRequest(code="CS102", title="Data Structures"),
        db=session,
        current_user=manager,
    )
    assert [course.code for course in detail.courses] == ["CS101", "CS102"]
    assert detail.course_count == 2
    cs101, cs102 = detail.courses

    # Course codes are unique within the programme.
    with pytest.raises(HTTPException) as exc:
        await api.add_course(
            programme_id=programme_id,
            payload=api.CourseCreateRequest(code="CS101", title="Repeat"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    detail = await api.update_course(
        programme_id=programme_id,
        course_id=cs101.id,
        payload=api.CourseUpdateRequest(contact_hours=75),
        db=session,
        current_user=manager,
    )
    assert detail.courses[0].contact_hours == 75

    detail = await api.reorder_courses(
        programme_id=programme_id,
        payload=api.CourseOrderRequest(course_ids=[cs102.id, cs101.id]),
        db=session,
        current_user=manager,
    )
    assert [course.code for course in detail.courses] == ["CS102", "CS101"]

    # A draft cannot jump straight to completed.
    with pytest.raises(HTTPException) as exc:
        await api.change_programme_status(
            programme_id=programme_id,
            payload=api.StatusChangeRequest(status="completed"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    detail = await api.change_programme_status(
        programme_id=programme_id,
        payload=api.StatusChangeRequest(status="active"),
        db=session,
        current_user=manager,
    )
    assert detail.status == "active"

    # Cohorts are created on the detail page.
    detail = await api.create_cohort(
        programme_id=programme_id,
        payload=api.CohortCreateRequest(
            name="September 2026 Intake",
            code="2026-SEP",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 6, 30),
            capacity=2,
            delivery_mode="hybrid",
            status="enrolling",
        ),
        db=session,
        current_user=manager,
    )
    assert detail.cohort_count == 1
    cohort = detail.cohorts[0]
    assert cohort.status == "enrolling"
    assert cohort.capacity == 2

    with pytest.raises(HTTPException) as exc:
        await api.create_cohort(
            programme_id=programme_id,
            payload=api.CohortCreateRequest(name="Bad dates",
                                             start_date=date(2027, 1, 1),
                                             end_date=date(2026, 1, 1)),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # Instructors.
    cohort_detail = await api.add_instructor(
        cohort_id=cohort.id,
        payload=api.InstructorRequest(
            person_id=data["manager_person"].id, role="lead"
        ),
        db=session,
        current_user=manager,
    )
    assert cohort_detail.instructors[0].role == "lead"

    with pytest.raises(HTTPException) as exc:
        await api.add_instructor(
            cohort_id=cohort.id,
            payload=api.InstructorRequest(person_id=data["manager_person"].id),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Enrolment enforces capacity.
    cohort_detail = await api.enrol_learners(
        cohort_id=cohort.id,
        payload=api.EnrolRequest(
            person_ids=[
                data["learner_person"].id,
                data["extra_person"].id,
            ],
            enrolled_on=date(2026, 9, 2),
        ),
        db=session,
        current_user=manager,
    )
    assert len(cohort_detail.enrolments) == 2
    assert cohort_detail.enrolled_count == 2
    assert cohort_detail.enrolments[0].enrolled_on == date(2026, 9, 2)

    enrol_extra = await api.enrol_learners(
        cohort_id=cohort.id,
        payload=api.EnrolRequest(person_ids=[data["extra_person"].id]),
        db=session,
        current_user=manager,
    )
    assert len(enrol_extra.enrolments) == 2  # duplicate skipped

    third_person = Person(
        first_name="Adwoa", last_name="Darko", email="adwoa@example.org"
    )
    session.add(third_person)
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.enrol_learners(
            cohort_id=cohort.id,
            payload=api.EnrolRequest(person_ids=[third_person.id]),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Capacity cannot be lowered below the current roster.
    with pytest.raises(HTTPException) as exc:
        await api.update_cohort(
            cohort_id=cohort.id,
            payload=api.CohortUpdateRequest(capacity=1),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Grades and completion.
    enrolment_id = cohort_detail.enrolments[0].id
    marked = await api.record_result(
        enrolment_id=enrolment_id,
        course_id=cs102.id,
        payload=api.ResultRequest(score=82.5, grade="A", status="passed"),
        db=session,
        current_user=manager,
    )
    assert marked.results[0].course_id == cs102.id
    assert marked.results[0].score == 82.5

    marked = await api.record_result(
        enrolment_id=enrolment_id,
        course_id=cs102.id,
        payload=api.ResultRequest(score=70, grade="B", status="passed"),
        db=session,
        current_user=manager,
    )
    assert len(marked.results) == 1
    assert marked.results[0].grade == "B"

    # A course from another programme is rejected.
    other = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="Other Programme",
            organisation_id=data["organisation"].id,
        ),
        db=session,
        current_user=manager,
    )
    other_detail = await api.add_course(
        programme_id=other.id,
        payload=api.CourseCreateRequest(title="Unrelated Course"),
        db=session,
        current_user=manager,
    )
    with pytest.raises(HTTPException) as exc:
        await api.record_result(
            enrolment_id=enrolment_id,
            course_id=other_detail.courses[0].id,
            payload=api.ResultRequest(score=50, status="failed"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    marked = await api.remove_result(
        enrolment_id=enrolment_id,
        course_id=cs102.id,
        db=session,
        current_user=manager,
    )
    assert marked.results == []

    completed = await api.update_enrolment(
        enrolment_id=enrolment_id,
        payload=api.EnrolmentUpdateRequest(status="completed"),
        db=session,
        current_user=manager,
    )
    assert completed.status == "completed"
    assert completed.completed_on == date.today()

    # Cohort stats reflect the learner and instructor.
    refreshed = await api.get_cohort(
        cohort_id=cohort.id,
        db=session,
        current_user=manager,
    )
    assert refreshed.enrolled_count == 2
    assert refreshed.instructor_count == 1
    assert refreshed.programme_name == "BSc Computer Science"

    # Programme lifecycle closes cohorts once completed.
    detail = await api.change_programme_status(
        programme_id=programme_id,
        payload=api.StatusChangeRequest(status="completed"),
        db=session,
        current_user=manager,
    )
    assert detail.status == "completed"
    assert detail.learner_count == 2

    with pytest.raises(HTTPException) as exc:
        await api.create_cohort(
            programme_id=programme_id,
            payload=api.CohortCreateRequest(name="Late Intake"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Archived programmes are terminal.
    detail = await api.change_programme_status(
        programme_id=programme_id,
        payload=api.StatusChangeRequest(status="archived"),
        db=session,
        current_user=manager,
    )
    assert detail.status == "archived"

    with pytest.raises(HTTPException) as exc:
        await api.change_programme_status(
            programme_id=programme_id,
            payload=api.StatusChangeRequest(status="active"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_enrolment_removal_and_closed_cohort(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]

    programme = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="Certificate in Data",
            organisation_id=data["organisation"].id,
        ),
        db=session,
        current_user=manager,
    )
    cohort_detail = await api.create_cohort(
        programme_id=programme.id,
        payload=api.CohortCreateRequest(
            name="Cohort One",
            delivery_mode="online",
            status="enrolling",
        ),
        db=session,
        current_user=manager,
    )
    cohort_id = cohort_detail.cohorts[0].id

    enrolled = await api.enrol_learners(
        cohort_id=cohort_id,
        payload=api.EnrolRequest(person_ids=[data["learner_person"].id]),
        db=session,
        current_user=manager,
    )
    enrolment_id = enrolled.enrolments[0].id

    removed = await api.remove_enrolment(
        enrolment_id=enrolment_id,
        db=session,
        current_user=manager,
    )
    assert removed.enrolments == []

    with pytest.raises(HTTPException) as exc:
        await api.get_cohort(
            cohort_id=cohort_id,
            db=session,
            current_user=data["viewer"],
        )
    assert exc.value.status_code == 404  # parent programme still a draft

    # Closing the cohort blocks further enrolments.
    await api.update_cohort(
        cohort_id=cohort_id,
        payload=api.CohortUpdateRequest(status="completed"),
        db=session,
        current_user=manager,
    )
    with pytest.raises(HTTPException) as exc:
        await api.enrol_learners(
            cohort_id=cohort_id,
            payload=api.EnrolRequest(person_ids=[data["extra_person"].id]),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 409

    # Removing an instructor who is not assigned 404s.
    with pytest.raises(HTTPException) as exc:
        await api.remove_instructor(
            cohort_id=cohort_id,
            person_id=data["extra_person"].id,
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_programme_validation(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]

    # Lead must be an active person.
    with pytest.raises(HTTPException) as exc:
        await api.create_programme(
            payload=api.ProgrammeCreateRequest(
                name="Ghost Lead",
                organisation_id=data["organisation"].id,
                lead_id="00000000-0000-0000-0000-000000000000",
            ),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # End date before start date is rejected.
    with pytest.raises(HTTPException) as exc:
        await api.create_programme(
            payload=api.ProgrammeCreateRequest(
                name="Backwards",
                organisation_id=data["organisation"].id,
                start_date=date(2026, 6, 1),
                end_date=date(2026, 1, 1),
            ),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # Unknown organisation is rejected.
    with pytest.raises(HTTPException) as exc:
        await api.create_programme(
            payload=api.ProgrammeCreateRequest(
                name="No Home",
                organisation_id="00000000-0000-0000-0000-000000000000",
            ),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # Unknown learners are rejected before any write.
    programme = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="Roster Check",
            organisation_id=data["organisation"].id,
        ),
        db=session,
        current_user=manager,
    )
    cohort_detail = await api.create_cohort(
        programme_id=programme.id,
        payload=api.CohortCreateRequest(name="Cohort A", status="enrolling"),
        db=session,
        current_user=manager,
    )
    with pytest.raises(HTTPException) as exc:
        await api.enrol_learners(
            cohort_id=cohort_detail.cohorts[0].id,
            payload=api.EnrolRequest(
                person_ids=["00000000-0000-0000-0000-000000000000"]
            ),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # Moving a course between programmes is rejected.
    other = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="Second Programme",
            organisation_id=data["organisation"].id,
        ),
        db=session,
        current_user=manager,
    )
    with pytest.raises(HTTPException) as exc:
        await api.update_course(
            programme_id=other.id,
            course_id="00000000-0000-0000-0000-000000000000",
            payload=api.CourseUpdateRequest(title="Nope"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_detail_survives_cold_session(session: AsyncSession):
    """Detail reads must not depend on objects cached in the identity map.

    A fresh request starts with an empty session, so related rows have to be
    eager-loaded; a lazy load there raises MissingGreenlet under asyncio.
    """
    data = await seed(session)
    manager = data["manager"]

    created = await api.create_programme(
        payload=api.ProgrammeCreateRequest(
            name="Cold Session Programme",
            organisation_id=data["organisation"].id,
            department_id=data["department"].id,
            lead_id=data["manager_person"].id,
        ),
        db=session,
        current_user=manager,
    )
    await session.commit()
    session.expunge_all()

    detail = await api.get_programme(
        programme_id=created.id,
        db=session,
        current_user=manager,
    )

    assert detail.organisation_name == "Shoova Academy"
    assert detail.department_name == "Academics"
    assert detail.lead and detail.lead.id == data["manager_person"].id

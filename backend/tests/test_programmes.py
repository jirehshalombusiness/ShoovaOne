"""End-to-end checks for the academic programmes API on an isolated SQLite DB.

Endpoints are invoked directly so the tests exercise the real business logic,
ORM mappings and audit writes without touching the configured database.
"""

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

import app.models.sql  # noqa: F401  (register every model)
from app.core.database import Base
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.role import Role, user_roles
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    EnrolmentResult,
    ProgrammeCohort,
    ProgrammeCourse,
)
from app.models.sql.programmes.learner_workflow import ModuleAssignment
from app.api.v1.endpoints.programmes import coursework as coursework_api
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
async def test_student_academic_performance_is_limited_to_own_enrolments(
    session: AsyncSession,
):
    data = await seed(session)
    programme = data["legacy"]
    course = ProgrammeCourse(
        programme_id=programme.id,
        code="CS101",
        title="Foundations",
        sequence=1,
    )
    pending_course = ProgrammeCourse(
        programme_id=programme.id,
        code="CS102",
        title="Next Steps",
        sequence=2,
    )
    cohort = ProgrammeCohort(programme_id=programme.id, name="2026 Intake")
    session.add_all([course, pending_course, cohort])
    await session.flush()

    student_enrolment = CohortEnrolment(
        cohort_id=cohort.id,
        person_id=data["manager_person"].id,
        status="enrolled",
        enrolled_on=date(2026, 9, 1),
    )
    other_enrolment = CohortEnrolment(
        cohort_id=cohort.id,
        person_id=data["learner_person"].id,
        status="enrolled",
    )
    session.add_all([student_enrolment, other_enrolment])
    await session.flush()
    session.add_all([
        EnrolmentResult(
            enrolment_id=student_enrolment.id,
            course_id=course.id,
            score=84,
            grade="B",
            status="passed",
        ),
        EnrolmentResult(
            enrolment_id=other_enrolment.id,
            course_id=course.id,
            score=12,
            grade="F",
            status="failed",
        ),
    ])
    await session.commit()

    report = await coursework_api.get_my_academic_performance(
        db=session,
        current_user=data["manager"],
    )

    assert report.student.id == data["manager_person"].id
    assert len(report.enrolments) == 1
    assert report.enrolments[0].enrolment_id == student_enrolment.id
    assert report.enrolments[0].programme_name == programme.name
    assert [
        (course.course_code, course.score, course.grade, course.status)
        for course in report.enrolments[0].courses
    ] == [
        ("CS101", 84, "B", "passed"),
        ("CS102", None, None, "pending"),
    ]


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


@pytest.mark.asyncio
async def test_create_programme_defaults_organisation(session: AsyncSession):
    """The creation form no longer asks for an organisation."""
    data = await seed(session)
    manager = data["manager"]

    created = await api.create_programme(
        payload=api.ProgrammeCreateRequest(name="No Org Asked"),
        db=session,
        current_user=manager,
    )
    assert created.organisation_id == data["organisation"].id
    assert created.organisation_name == "Shoova Academy"
    assert created.department_name is None
    assert created.status == "draft"


@pytest.mark.asyncio
async def test_create_programme_prefers_shoova_code(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]

    # A second, SHOOVA-coded organisation wins over the older seeded one.
    shoova = Organisation(name="Shoova Initiative", code="SHOOVA")
    session.add(shoova)
    await session.commit()

    created = await api.create_programme(
        payload=api.ProgrammeCreateRequest(name="Default Home"),
        db=session,
        current_user=manager,
    )
    assert created.organisation_id == shoova.id
    assert created.organisation_name == "Shoova Initiative"


@pytest.mark.asyncio
async def test_create_programme_without_any_organisation(session: AsyncSession):
    person = Person(first_name="Solo", last_name="Admin", email="solo@example.org")
    session.add(person)
    await session.flush()
    manager = User(
        person_id=person.id, email="solo@example.org", password_hash="x"
    )
    session.add(manager)
    await session.flush()
    ceo_role = Role(name="ceo", description="Chief Executive")
    session.add(ceo_role)
    await session.flush()
    await session.execute(
        user_roles.insert().values(user_id=manager.id, role_id=ceo_role.id)
    )
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.create_programme(
            payload=api.ProgrammeCreateRequest(name="Orphan"),
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400


async def _directory_programme(session: AsyncSession, data, manager):
    """An active programme with one cohort, two learners and module counts."""
    programme = await api.create_programme(
        payload=api.ProgrammeCreateRequest(name="Environmental Stewardship"),
        db=session,
        current_user=manager,
    )
    detail = await api.add_course(
        programme_id=programme.id,
        payload=api.CourseCreateRequest(code="ENV101", title="Auditing"),
        db=session,
        current_user=manager,
    )
    detail = await api.add_course(
        programme_id=programme.id,
        payload=api.CourseCreateRequest(code="ENV102", title="Recycling"),
        db=session,
        current_user=manager,
    )
    env101, env102 = detail.courses
    await api.change_programme_status(
        programme_id=programme.id,
        payload=api.StatusChangeRequest(status="active"),
        db=session,
        current_user=manager,
    )
    cohort_detail = await api.create_cohort(
        programme_id=programme.id,
        payload=api.CohortCreateRequest(
            name="Pilot Cohort", code="ENV-PILOT", status="enrolling"
        ),
        db=session,
        current_user=manager,
    )
    cohort = cohort_detail.cohorts[0]
    enrolled = await api.enrol_learners(
        cohort_id=cohort.id,
        payload=api.EnrolRequest(
            person_ids=[
                data["learner_person"].id,
                data["extra_person"].id,
            ],
            enrolled_on=date(2026, 11, 2),
        ),
        db=session,
        current_user=manager,
    )
    await api.add_instructor(
        cohort_id=cohort.id,
        payload=api.InstructorRequest(
            person_id=data["manager_person"].id, role="lead"
        ),
        db=session,
        current_user=manager,
    )

    rows = (
        await session.execute(
            select(CohortEnrolment).where(
                CohortEnrolment.cohort_id == cohort.id
            )
        )
    ).scalars().all()
    by_person = {str(row.person_id): row for row in rows}
    kofi = by_person[str(data["learner_person"].id)]
    efua = by_person[str(data["extra_person"].id)]
    session.add_all(
        [
            ModuleAssignment(
                enrolment_id=kofi.id,
                course_id=env101.id,
                competency="Audit a community",
                status="completed",
            ),
            ModuleAssignment(
                enrolment_id=kofi.id,
                course_id=env102.id,
                competency="Segregate waste",
                status="assigned",
            ),
            ModuleAssignment(
                enrolment_id=efua.id,
                course_id=env101.id,
                competency="Audit a community",
                status="assigned",
            ),
        ]
    )
    await session.commit()
    return programme, cohort, enrolled, kofi


@pytest.mark.asyncio
async def test_learner_directory(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]
    viewer = data["viewer"]
    programme, cohort, enrolled, kofi = await _directory_programme(
        session, data, manager
    )

    learners = await api.list_learners(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert len(learners) == 2
    assert {item.programme_id for item in learners} == {programme.id}
    assert {item.cohort_id for item in learners} == {cohort.id}
    assert all(item.programme_name == "Environmental Stewardship" for item in learners)
    assert all(item.cohort_name == "Pilot Cohort" for item in learners)

    kofi_item = next(
        item for item in learners if item.person.id == data["learner_person"].id
    )
    assert kofi_item.assignments_total == 2
    assert kofi_item.assignments_completed == 1
    assert kofi_item.enrolment_id == kofi.id
    assert kofi_item.enrolled_on == date(2026, 11, 2)
    efua_item = next(
        item for item in learners if item.person.id == data["extra_person"].id
    )
    assert efua_item.assignments_total == 1
    assert efua_item.assignments_completed == 0

    # Search by learner name.
    found = await api.list_learners(
        programme_id=None,
        status_filter=None,
        search="Kofi",
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert [item.person.id for item in found] == [data["learner_person"].id]

    # Filter by programme.
    scoped = await api.list_learners(
        programme_id=programme.id,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert len(scoped) == 2

    # Complete one learner, then filter by status.
    await api.update_enrolment(
        enrolment_id=kofi.id,
        payload=api.EnrolmentUpdateRequest(status="completed"),
        db=session,
        current_user=manager,
    )
    completed = await api.list_learners(
        programme_id=None,
        status_filter="completed",
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert [item.person.id for item in completed] == [data["learner_person"].id]

    # Invalid status is rejected.
    with pytest.raises(HTTPException) as exc:
        await api.list_learners(
            programme_id=None,
            status_filter="bogus",
            search=None,
            limit=200,
            offset=0,
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # A draft programme's learners stay hidden from non-managers.
    draft = await api.create_programme(
        payload=api.ProgrammeCreateRequest(name="Hidden Draft"),
        db=session,
        current_user=manager,
    )
    draft_cohort = await api.create_cohort(
        programme_id=draft.id,
        payload=api.CohortCreateRequest(name="Draft Cohort", status="enrolling"),
        db=session,
        current_user=manager,
    )
    await api.enrol_learners(
        cohort_id=draft_cohort.cohorts[0].id,
        payload=api.EnrolRequest(person_ids=[data["learner_person"].id]),
        db=session,
        current_user=manager,
    )
    viewer_view = await api.list_learners(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=viewer,
    )
    assert {item.programme_id for item in viewer_view} == {programme.id}
    manager_view = await api.list_learners(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert draft.id in {item.programme_id for item in manager_view}


@pytest.mark.asyncio
async def test_cohort_directory(session: AsyncSession):
    data = await seed(session)
    manager = data["manager"]
    viewer = data["viewer"]
    programme, cohort, enrolled, kofi = await _directory_programme(
        session, data, manager
    )

    cohorts = await api.list_cohorts(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    pilot = next(item for item in cohorts if item.id == cohort.id)
    assert pilot.programme_name == "Environmental Stewardship"
    assert pilot.enrolled_count == 2
    assert pilot.instructor_count == 1
    assert pilot.code == "ENV-PILOT"

    # Search by cohort name and by parent programme name.
    by_name = await api.list_cohorts(
        programme_id=None,
        status_filter=None,
        search="Pilot",
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert [item.id for item in by_name] == [cohort.id]
    by_programme = await api.list_cohorts(
        programme_id=None,
        status_filter=None,
        search="Environmental",
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert [item.id for item in by_programme] == [cohort.id]

    # Status filter.
    enrolling = await api.list_cohorts(
        programme_id=None,
        status_filter="enrolling",
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert cohort.id in {item.id for item in enrolling}
    planned = await api.list_cohorts(
        programme_id=None,
        status_filter="planned",
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert cohort.id not in {item.id for item in planned}

    with pytest.raises(HTTPException) as exc:
        await api.list_cohorts(
            programme_id=None,
            status_filter="bogus",
            search=None,
            limit=200,
            offset=0,
            db=session,
            current_user=manager,
        )
    assert exc.value.status_code == 400

    # Draft programme cohorts are hidden from non-managers.
    draft = await api.create_programme(
        payload=api.ProgrammeCreateRequest(name="Hidden Draft"),
        db=session,
        current_user=manager,
    )
    draft_cohort = await api.create_cohort(
        programme_id=draft.id,
        payload=api.CohortCreateRequest(name="Draft Cohort"),
        db=session,
        current_user=manager,
    )
    viewer_view = await api.list_cohorts(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=viewer,
    )
    assert draft_cohort.cohorts[0].id not in {item.id for item in viewer_view}
    assert cohort.id in {item.id for item in viewer_view}
    manager_view = await api.list_cohorts(
        programme_id=None,
        status_filter=None,
        search=None,
        limit=200,
        offset=0,
        db=session,
        current_user=manager,
    )
    assert draft_cohort.cohorts[0].id in {item.id for item in manager_view}

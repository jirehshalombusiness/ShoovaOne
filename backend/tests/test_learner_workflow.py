"""End-to-end checks for the learner workflow API on an isolated SQLite DB.

Endpoints are invoked directly so the tests exercise the real business logic,
ORM mappings and audit writes without touching the configured database.
Permission gates are tested by invoking the require_* dependency itself.
"""

from datetime import date, timedelta

import pytest
import pytest_asyncio
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

import app.models.sql  # noqa: F401  (register every model)
from app.core.database import Base
from app.core.security import (
    Permissions,
    require_all_permissions,
    require_permission,
)
from app.models.sql.core.organisation import Organisation, Programme
from app.models.sql.core.role import Role, Permission, user_roles, role_permissions
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    ProgrammeCohort,
    ProgrammeCourse,
)
from app.services.core.permission_service import PermissionService
from app.api.v1.endpoints.programmes import learner_workflow as api


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
    await PermissionService.ensure_permission_catalog(db)

    organisation = Organisation(name="Shoova Academy")
    db.add(organisation)
    await db.flush()

    programme = Programme(
        organisation_id=organisation.id,
        name="Environmental Stewardship",
        status="active",
    )
    db.add(programme)
    await db.flush()

    course = ProgrammeCourse(
        programme_id=programme.id,
        title="Environmental Stewardship Foundations",
        sequence=1,
    )
    other_course = ProgrammeCourse(
        programme_id=programme.id,
        title="Community Engagement",
        sequence=2,
    )
    cohort = ProgrammeCohort(
        programme_id=programme.id,
        name="Pilot 2026",
        status="active",
    )
    db.add_all([course, other_course, cohort])
    await db.flush()

    people = {}
    for key, first, last in (
        ("learner", "Kofi", "Boateng"),
        ("learner2", "Efua", "Owusu"),
        ("manager", "Ama", "Mensah"),
        ("mentor", "Kwame", "Asante"),
        ("viewer", "Yaw", "Asare"),
        ("stranger", "Akosua", "Boateng"),
    ):
        person = Person(
            first_name=first,
            last_name=last,
            email=f"{key}@example.org",
            type="beneficiary" if key.startswith("learner") else "staff",
        )
        db.add(person)
        people[key] = person
    await db.flush()

    enrolment = CohortEnrolment(
        cohort_id=cohort.id,
        person_id=people["learner"].id,
        enrolled_on=date.today(),
    )
    enrolment2 = CohortEnrolment(
        cohort_id=cohort.id,
        person_id=people["learner2"].id,
        enrolled_on=date.today(),
    )
    db.add_all([enrolment, enrolment2])
    await db.flush()

    users = {}
    for key in ("manager", "mentor", "viewer", "stranger"):
        user = User(
            person_id=people[key].id,
            email=people[key].email,
            password_hash="x",
        )
        db.add(user)
        users[key] = user
    await db.flush()

    ceo_role = Role(name="ceo")
    db.add(ceo_role)
    await db.flush()
    await db.execute(
        user_roles.insert().values(user_id=users["manager"].id, role_id=ceo_role.id)
    )

    async def role_with(name, actions):
        role = Role(name=name)
        db.add(role)
        await db.flush()
        for action in actions:
            permission = (
                await db.execute(
                    select(Permission).where(
                        Permission.resource == "programmes",
                        Permission.action == action,
                    )
                )
            ).scalar_one()
            await db.execute(
                role_permissions.insert().values(
                    role_id=role.id, permission_id=permission.id
                )
            )
        return role

    mentor_role = await role_with("mentor", ["view", "assess"])
    viewer_role = await role_with("viewer", ["view"])
    await db.execute(
        user_roles.insert().values(user_id=users["mentor"].id, role_id=mentor_role.id)
    )
    await db.execute(
        user_roles.insert().values(user_id=users["viewer"].id, role_id=viewer_role.id)
    )
    await db.commit()

    return {
        **users,
        "people": people,
        "organisation": organisation,
        "programme": programme,
        "course": course,
        "other_course": other_course,
        "cohort": cohort,
        "enrolment": enrolment,
        "enrolment2": enrolment2,
    }


async def assign_and_task(db, data, enrolment=None):
    """Helper: one module assignment with one practical task."""
    enrolment = enrolment or data["enrolment"]
    assignment = await api.assign_module(
        enrolment_id=str(enrolment.id),
        payload=api.AssignmentCreateRequest(
            course_id=str(data["course"].id),
            competency="Conduct a site environmental observation",
            due_on=date.today() + timedelta(days=7),
        ),
        db=db,
        current_user=data["manager"],
    )
    task = await api.create_task(
        assignment_id=assignment.id,
        payload=api.TaskCreateRequest(
            title="Site observation walk",
            location="Achimota Forest",
            expected_evidence="Photos, GPS coordinates and a reflection",
        ),
        db=db,
        current_user=data["manager"],
    )
    return assignment, task


# ============================================================
# FULL JOURNEY
# ============================================================

@pytest.mark.asyncio
async def test_full_journey(session: AsyncSession):
    data = await seed(session)
    assignment, task = await assign_and_task(session, data)
    assert assignment.status == "assigned"

    evidence = await api.submit_evidence(
        task_id=task.id,
        payload=api.EvidenceCreateRequest(
            evidence_type="observation",
            field_notes="Drainage blocked at the north edge",
            reflection="Learned to identify runoff risks",
            gps_lat=5.614,
            gps_lng=-0.234,
            location_label="Achimota Forest",
        ),
        db=session,
        current_user=data["manager"],
    )
    assert evidence.submitted_by.id == str(data["people"]["manager"].id)

    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.assignments[0].status == "submitted"
    assert journey.assignments[0].tasks[0].status == "submitted"
    assert journey.assignments[0].tasks[0].evidence[0].gps_lat == 5.614
    assert journey.progress.readiness == "in_progress"
    assert journey.progress.competencies_pending == 1

    assessment = await api.assess_evidence(
        evidence_id=evidence.id,
        payload=api.AssessmentCreateRequest(
            competency_result="met",
            feedback="Well documented",
            evidence_quality="strong",
        ),
        db=session,
        current_user=data["mentor"],
    )
    assert assessment.mentor.id == str(data["people"]["mentor"].id)

    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    item = journey.assignments[0]
    assert item.status == "completed"
    assert item.completed_on == date.today()
    assert item.tasks[0].status == "completed"
    assert item.tasks[0].evidence[0].assessments[0].competency_result == "met"
    assert journey.progress.readiness == "ready_for_completion"
    assert journey.progress.competencies_completed == 1
    assert journey.progress.competencies_pending == 0
    assert journey.progress.next_module is None

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.active_learners == 2
    assert dashboard.assignments_total == 1
    assert dashboard.module_completion_rate == 100.0
    assert dashboard.competencies_demonstrated == 1
    assert dashboard.tasks_completed == 1
    assert dashboard.evidence_submissions == 1
    assert dashboard.assessments_completed == 1
    assert dashboard.assessments_overdue == 0


@pytest.mark.asyncio
async def test_follow_up_then_completion(session: AsyncSession):
    data = await seed(session)
    assignment, task = await assign_and_task(session, data)
    evidence = await api.submit_evidence(
        task_id=task.id,
        payload=api.EvidenceCreateRequest(evidence_type="note", field_notes="Notes only"),
        db=session,
        current_user=data["manager"],
    )
    await api.assess_evidence(
        evidence_id=evidence.id,
        payload=api.AssessmentCreateRequest(
            competency_result="not_met",
            feedback="Photos missing",
            follow_up="Resubmit with close-up photos",
            evidence_quality="weak",
        ),
        db=session,
        current_user=data["mentor"],
    )

    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.assignments[0].status == "follow_up"
    assert journey.progress.next_action == "Resubmit with close-up photos"
    assert journey.progress.readiness == "in_progress"

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert len(dashboard.learners_needing_follow_up) == 1
    follow_up = dashboard.learners_needing_follow_up[0]
    assert follow_up.enrolment_id == str(data["enrolment"].id)
    assert follow_up.next_action == "Resubmit with close-up photos"

    # Resubmission assessed as met clears the follow-up and completes the module.
    evidence2 = await api.submit_evidence(
        task_id=task.id,
        payload=api.EvidenceCreateRequest(
            evidence_type="photo", file_url="https://example.org/photo.jpg"
        ),
        db=session,
        current_user=data["manager"],
    )
    await api.assess_evidence(
        evidence_id=evidence2.id,
        payload=api.AssessmentCreateRequest(competency_result="met"),
        db=session,
        current_user=data["mentor"],
    )
    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.assignments[0].status == "completed"
    assert journey.assignments[0].next_action is None
    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.learners_needing_follow_up == []


# ============================================================
# PERMISSIONS
# ============================================================

@pytest.mark.asyncio
async def test_baseline_visibility_is_permission_gated(session: AsyncSession):
    data = await seed(session)
    await api.record_baseline(
        enrolment_id=str(data["enrolment"].id),
        payload=api.BaselineRequest(
            household_income_band="below_500",
            employment_status="unemployed",
            can_afford_training="no",
            vulnerability_class="high",
            household_dependents=3,
        ),
        db=session,
        current_user=data["manager"],
    )

    manager_view = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert manager_view.can_view_baseline is True
    assert manager_view.baseline.vulnerability_class == "high"

    for key in ("viewer", "mentor"):
        restricted = await api.get_journey(
            enrolment_id=str(data["enrolment"].id),
            db=session,
            current_user=data[key],
        )
        assert restricted.can_view_baseline is False
        assert restricted.baseline is None
        # The rest of the journey stays visible.
        assert restricted.person.id == str(data["people"]["learner"].id)


@pytest.mark.asyncio
async def test_permission_dependencies(session: AsyncSession):
    data = await seed(session)

    # Assess gate: mentor passes, viewer is rejected.
    gate = require_permission(Permissions.PROGRAMMES_ASSESS)
    assert await gate(current_user=data["mentor"], db=session)
    with pytest.raises(HTTPException) as exc:
        await gate(current_user=data["viewer"], db=session)
    assert exc.value.status_code == 403

    # Baseline write gate: needs view_baseline AND edit; mentor has neither edit nor baseline.
    baseline_gate = require_all_permissions(
        [Permissions.PROGRAMMES_VIEW_BASELINE, Permissions.PROGRAMMES_EDIT]
    )
    assert await baseline_gate(current_user=data["manager"], db=session)
    with pytest.raises(HTTPException) as exc:
        await baseline_gate(current_user=data["mentor"], db=session)
    assert exc.value.status_code == 403

    # Journey gate: a user with no programmes permission is rejected.
    view_gate = require_permission(Permissions.PROGRAMMES_VIEW)
    with pytest.raises(HTTPException) as exc:
        await view_gate(current_user=data["stranger"], db=session)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_draft_programme_hidden_from_non_managers(session: AsyncSession):
    data = await seed(session)
    data["programme"].status = "draft"
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.get_journey(
            enrolment_id=str(data["enrolment"].id),
            db=session,
            current_user=data["viewer"],
        )
    assert exc.value.status_code == 404

    with pytest.raises(HTTPException) as exc:
        await api.get_cohort_dashboard(
            cohort_id=str(data["cohort"].id),
            db=session,
            current_user=data["viewer"],
        )
    assert exc.value.status_code == 404

    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.enrolment_id == str(data["enrolment"].id)


# ============================================================
# BASELINE AND OUTCOME UPSERTS
# ============================================================

@pytest.mark.asyncio
async def test_baseline_upsert_replaces_fields(session: AsyncSession):
    data = await seed(session)
    first = await api.record_baseline(
        enrolment_id=str(data["enrolment"].id),
        payload=api.BaselineRequest(
            employment_status="unemployed", vulnerability_class="high"
        ),
        db=session,
        current_user=data["manager"],
    )
    assert first.employment_status == "unemployed"

    second = await api.record_baseline(
        enrolment_id=str(data["enrolment"].id),
        payload=api.BaselineRequest(
            employment_status="employed", vulnerability_class="low"
        ),
        db=session,
        current_user=data["manager"],
    )
    assert second.employment_status == "employed"
    assert second.vulnerability_class == "low"

    rows = (
        await session.execute(
            select(app.models.sql.LearnerBaseline).where(
                app.models.sql.LearnerBaseline.enrolment_id == data["enrolment"].id
            )
        )
    ).scalars().all()
    assert len(rows) == 1


@pytest.mark.asyncio
async def test_outcome_upsert(session: AsyncSession):
    data = await seed(session)
    await api.record_outcome(
        enrolment_id=str(data["enrolment"].id),
        payload=api.OutcomeRequest(
            demonstrated_skills="Site observation", placement_status="seeking"
        ),
        db=session,
        current_user=data["manager"],
    )
    await api.record_outcome(
        enrolment_id=str(data["enrolment"].id),
        payload=api.OutcomeRequest(
            demonstrated_skills="Site observation, GPS capture",
            placement_status="employed",
            follow_up_status="scheduled",
            follow_up_on=date.today() + timedelta(days=30),
        ),
        db=session,
        current_user=data["manager"],
    )
    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.outcome.placement_status == "employed"
    assert journey.outcome.follow_up_status == "scheduled"

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.outcomes_recorded == 1


# ============================================================
# VALIDATION
# ============================================================

@pytest.mark.asyncio
async def test_duplicate_assignment_rejected(session: AsyncSession):
    data = await seed(session)
    await assign_and_task(session, data)
    with pytest.raises(HTTPException) as exc:
        await api.assign_module(
            enrolment_id=str(data["enrolment"].id),
            payload=api.AssignmentCreateRequest(
                course_id=str(data["course"].id), competency="Duplicate attempt"
            ),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_assignment_course_must_belong_to_programme(session: AsyncSession):
    data = await seed(session)
    other_programme = Programme(
        organisation_id=data["organisation"].id, name="Other Programme"
    )
    session.add(other_programme)
    await session.flush()
    foreign_course = ProgrammeCourse(
        programme_id=other_programme.id, title="Foreign Course"
    )
    session.add(foreign_course)
    await session.commit()

    with pytest.raises(HTTPException) as exc:
        await api.assign_module(
            enrolment_id=str(data["enrolment"].id),
            payload=api.AssignmentCreateRequest(
                course_id=str(foreign_course.id), competency="Not allowed"
            ),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_evidence_validation(session: AsyncSession):
    data = await seed(session)
    _, task = await assign_and_task(session, data)

    # GPS coordinates must come as a pair.
    with pytest.raises(HTTPException) as exc:
        await api.submit_evidence(
            task_id=task.id,
            payload=api.EvidenceCreateRequest(evidence_type="gps", gps_lat=5.6),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 400

    # Links must be http(s).
    with pytest.raises(HTTPException) as exc:
        await api.submit_evidence(
            task_id=task.id,
            payload=api.EvidenceCreateRequest(file_url="ftp://example.org/file"),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 400

    # Unknown document reference.
    with pytest.raises(HTTPException) as exc:
        await api.submit_evidence(
            task_id=task.id,
            payload=api.EvidenceCreateRequest(
                document_id="00000000-0000-0000-0000-000000000000"
            ),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_invalid_vocabularies_rejected():
    with pytest.raises(ValidationError):
        api.AssignmentUpdateRequest(status="done")
    with pytest.raises(ValidationError):
        api.TaskUpdateRequest(status="finished")
    with pytest.raises(ValidationError):
        api.EvidenceCreateRequest(evidence_type="video")
    with pytest.raises(ValidationError):
        api.AssessmentCreateRequest(competency_result="passed")
    with pytest.raises(ValidationError):
        api.AssessmentCreateRequest(competency_result="met", evidence_quality="excellent")
    with pytest.raises(ValidationError):
        api.BaselineRequest(vulnerability_class="extreme")
    with pytest.raises(ValidationError):
        api.BaselineRequest(can_afford_training="maybe")
    with pytest.raises(ValidationError):
        api.EvidenceCreateRequest(gps_lat=95.0)


@pytest.mark.asyncio
async def test_unknown_ids_return_404(session: AsyncSession):
    data = await seed(session)
    missing = "00000000-0000-0000-0000-000000000000"
    with pytest.raises(HTTPException) as exc:
        await api.get_journey(enrolment_id=missing, db=session, current_user=data["manager"])
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await api.update_assignment(
            assignment_id=missing,
            payload=api.AssignmentUpdateRequest(status="in_progress"),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 404


# ============================================================
# MANUAL STATUS UPDATES
# ============================================================

@pytest.mark.asyncio
async def test_manual_status_updates(session: AsyncSession):
    data = await seed(session)
    assignment, task = await assign_and_task(session, data)

    updated = await api.update_assignment(
        assignment_id=assignment.id,
        payload=api.AssignmentUpdateRequest(status="completed"),
        db=session,
        current_user=data["manager"],
    )
    assert updated.status == "completed"
    assert updated.completed_on == date.today()

    reopened = await api.update_assignment(
        assignment_id=assignment.id,
        payload=api.AssignmentUpdateRequest(status="in_progress"),
        db=session,
        current_user=data["manager"],
    )
    assert reopened.status == "in_progress"
    assert reopened.completed_on is None

    done_task = await api.update_task(
        task_id=task.id,
        payload=api.TaskUpdateRequest(status="completed"),
        db=session,
        current_user=data["manager"],
    )
    assert done_task.status == "completed"
    assert done_task.completed_on == date.today()

    with pytest.raises(HTTPException) as exc:
        await api.update_task(
            task_id=task.id,
            payload=api.TaskUpdateRequest(),
            db=session,
            current_user=data["manager"],
        )
    assert exc.value.status_code == 400


# ============================================================
# DASHBOARD MATH
# ============================================================

@pytest.mark.asyncio
async def test_dashboard_overdue_assessments(session: AsyncSession):
    data = await seed(session)
    _, task = await assign_and_task(session, data)

    old_evidence = await api.submit_evidence(
        task_id=task.id,
        payload=api.EvidenceCreateRequest(
            evidence_type="note",
            field_notes="Waiting on mentor",
            recorded_on=date.today() - timedelta(days=8),
        ),
        db=session,
        current_user=data["manager"],
    )
    await api.submit_evidence(
        task_id=task.id,
        payload=api.EvidenceCreateRequest(
            evidence_type="note",
            field_notes="Recent",
            recorded_on=date.today() - timedelta(days=3),
        ),
        db=session,
        current_user=data["manager"],
    )

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.assessments_overdue == 1
    assert dashboard.overdue_evidence[0].evidence_id == old_evidence.id
    assert dashboard.overdue_evidence[0].days_waiting == 8
    assert dashboard.overdue_evidence[0].person.id == str(data["people"]["learner"].id)

    await api.assess_evidence(
        evidence_id=old_evidence.id,
        payload=api.AssessmentCreateRequest(competency_result="met"),
        db=session,
        current_user=data["mentor"],
    )
    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.assessments_overdue == 0
    assert dashboard.overdue_evidence == []


@pytest.mark.asyncio
async def test_dashboard_rollup_math(session: AsyncSession):
    data = await seed(session)

    # Learner 1 completes; learner 2 lands in follow-up.
    assignment1, task1 = await assign_and_task(session, data)
    evidence1 = await api.submit_evidence(
        task_id=task1.id,
        payload=api.EvidenceCreateRequest(evidence_type="photo"),
        db=session,
        current_user=data["manager"],
    )
    await api.assess_evidence(
        evidence_id=evidence1.id,
        payload=api.AssessmentCreateRequest(competency_result="met"),
        db=session,
        current_user=data["mentor"],
    )
    assignment2, task2 = await assign_and_task(session, data, enrolment=data["enrolment2"])
    evidence2 = await api.submit_evidence(
        task_id=task2.id,
        payload=api.EvidenceCreateRequest(evidence_type="note"),
        db=session,
        current_user=data["manager"],
    )
    await api.assess_evidence(
        evidence_id=evidence2.id,
        payload=api.AssessmentCreateRequest(
            competency_result="partially_met", follow_up="More field notes needed"
        ),
        db=session,
        current_user=data["mentor"],
    )

    for enrolment, vulnerability in (
        (data["enrolment"], "high"),
        (data["enrolment2"], "low"),
    ):
        await api.record_baseline(
            enrolment_id=str(enrolment.id),
            payload=api.BaselineRequest(vulnerability_class=vulnerability),
            db=session,
            current_user=data["manager"],
        )
    await api.record_outcome(
        enrolment_id=str(data["enrolment"].id),
        payload=api.OutcomeRequest(placement_status="employed"),
        db=session,
        current_user=data["manager"],
    )

    # A withdrawn enrolment must not count toward active learners.
    withdrawn_person = Person(first_name="Withdrawn", last_name="Learner")
    session.add(withdrawn_person)
    await session.flush()
    session.add(
        CohortEnrolment(
            cohort_id=data["cohort"].id,
            person_id=withdrawn_person.id,
            status="withdrawn",
        )
    )
    await session.commit()

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.active_learners == 2
    assert dashboard.assignments_total == 2
    assert dashboard.assignments_completed == 1
    assert dashboard.module_completion_rate == 50.0
    assert dashboard.competencies_demonstrated == 1
    assert dashboard.competencies_pending == 1
    assert dashboard.tasks_total == 2
    assert dashboard.tasks_completed == 1
    assert dashboard.evidence_submissions == 2
    assert dashboard.assessments_completed == 2
    assert len(dashboard.learners_needing_follow_up) == 1
    assert dashboard.learners_needing_follow_up[0].enrolment_id == str(data["enrolment2"].id)
    assert dashboard.outcomes_recorded == 1
    assert dashboard.vulnerability.recorded == 2
    assert dashboard.vulnerability.high == 1
    assert dashboard.vulnerability.low == 1
    assert dashboard.vulnerability.high_percent == 50.0

    # Vulnerability is stripped for viewers without programmes.view_baseline.
    restricted = await api.get_cohort_dashboard(
        cohort_id=str(data["cohort"].id),
        db=session,
        current_user=data["viewer"],
    )
    assert restricted.vulnerability is None
    assert restricted.module_completion_rate == 50.0


@pytest.mark.asyncio
async def test_empty_cohort_dashboard(session: AsyncSession):
    data = await seed(session)
    empty_cohort = ProgrammeCohort(
        programme_id=data["programme"].id, name="Empty Cohort"
    )
    session.add(empty_cohort)
    await session.commit()

    dashboard = await api.get_cohort_dashboard(
        cohort_id=str(empty_cohort.id),
        db=session,
        current_user=data["manager"],
    )
    assert dashboard.active_learners == 0
    assert dashboard.assignments_total == 0
    assert dashboard.module_completion_rate == 0.0
    assert dashboard.assessments_overdue == 0
    assert dashboard.learners_needing_follow_up == []
    assert dashboard.vulnerability.recorded == 0
    assert dashboard.vulnerability.high_percent is None


@pytest.mark.asyncio
async def test_progress_next_module_by_due_date(session: AsyncSession):
    data = await seed(session)
    await api.assign_module(
        enrolment_id=str(data["enrolment"].id),
        payload=api.AssignmentCreateRequest(
            course_id=str(data["other_course"].id),
            competency="Later competency",
            due_on=date.today() + timedelta(days=21),
        ),
        db=session,
        current_user=data["manager"],
    )
    await api.assign_module(
        enrolment_id=str(data["enrolment"].id),
        payload=api.AssignmentCreateRequest(
            course_id=str(data["course"].id),
            competency="Sooner competency",
            due_on=date.today() + timedelta(days=7),
        ),
        db=session,
        current_user=data["manager"],
    )
    journey = await api.get_journey(
        enrolment_id=str(data["enrolment"].id),
        db=session,
        current_user=data["manager"],
    )
    assert journey.progress.next_module == "Environmental Stewardship Foundations"
    assert journey.progress.next_action == "Start the learning module"
    assert journey.progress.competencies_pending == 2
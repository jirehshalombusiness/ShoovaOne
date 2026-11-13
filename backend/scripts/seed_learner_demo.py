"""Seed a LOCAL-ONLY learner workflow demo (Environmental Stewardship).

Hard-refuses any DATABASE_URL that is not SQLite. Never run this against
production — all people, accounts and records created here are fictional.

Usage (from backend/):
    DATABASE_URL=sqlite:///./demo_learner.db python scripts/seed_learner_demo.py
    DATABASE_URL=sqlite:///./demo_learner.db python scripts/seed_learner_demo.py --full

Without --full the learner is at the start of the journey (enrolled, baseline
recorded, one module assigned, one field task pending) so the demo can be
driven live in the browser. With --full the journey is completed through
evidence, mentor assessment and outcome.

Demo accounts (password: DEMO_PASSWORD env var, default "DemoPass123!"):
    demo.manager@example.com  programmes view/edit/assess/view_baseline, people.view
    demo.mentor@example.com   programmes view/assess only — cannot see baselines
"""
import argparse
import asyncio
import datetime as dt
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

import app.models.sql  # noqa: F401  (register every table before create_all)
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.models.sql.base import Base
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.role import Permission, user_permissions
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    CohortInstructor,
    ProgrammeCohort,
    ProgrammeCourse,
)
from app.models.sql.programmes.learner_workflow import (
    EvidenceRecord,
    LearnerBaseline,
    LearnerOutcome,
    MentorAssessment,
    ModuleAssignment,
    PracticalTask,
)
from app.services.core.permission_service import PermissionService

DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "DemoPass123!")

MANAGER_EMAIL = "demo.manager@example.com"
MENTOR_EMAIL = "demo.mentor@example.com"
LEARNER_EMAIL = "efua.nyarko.demo@example.com"

PROGRAMME_CODE = "ENV-STEW"

MANAGER_PERMISSIONS = [
    ("programmes", "view"),
    ("programmes", "edit"),
    ("programmes", "assess"),
    ("programmes", "view_baseline"),
    ("people", "view"),
]
MENTOR_PERMISSIONS = [
    ("programmes", "view"),
    ("programmes", "assess"),
]

FICTIONAL_BIO = "Fictional demo record — local learner workflow prototype only."


async def one(db, model, **filters):
    return (
        await db.execute(select(model).filter_by(**filters))
    ).scalars().first()


async def person(db, *, email, first_name, last_name, type, job_title=None):
    existing = await one(db, Person, email=email)
    if existing:
        return existing
    record = Person(
        email=email,
        first_name=first_name,
        last_name=last_name,
        type=type,
        status="active",
        job_title=job_title,
        organization="Shoova Initiative",
        country="Ghana",
        country_code="GH",
        bio=FICTIONAL_BIO,
    )
    db.add(record)
    await db.flush()
    return record


async def user(db, *, person_record, email, permissions):
    existing = await one(db, User, email=email)
    if existing:
        return existing
    record = User(
        person_id=person_record.id,
        email=email,
        password_hash=get_password_hash(DEMO_PASSWORD),
        is_active=True,
        must_change_password=False,
    )
    db.add(record)
    await db.flush()

    for resource, action in permissions:
        permission = await one(db, Permission, resource=resource, action=action)
        if permission is None:
            raise SystemExit(
                f"Permission {resource}.{action} missing — catalog sync failed."
            )
        await db.execute(
            user_permissions.insert().values(
                user_id=record.id, permission_id=permission.id
            )
        )
    return record


async def main(full: bool) -> None:
    if not settings.DATABASE_URL.startswith("sqlite"):
        raise SystemExit(
            "Refusing to seed: DATABASE_URL is not SQLite. "
            "This demo is local-only. Run with e.g. "
            "DATABASE_URL=sqlite:///./demo_learner.db"
        )

    today = dt.date.today()
    cohort_start = today + dt.timedelta(days=30)
    cohort_end = cohort_start + dt.timedelta(weeks=7)
    cohort_code = f"ENV-{cohort_start.year}-PILOT"
    cohort_name = f"Pilot Cohort — {cohort_start:%B %Y}"
    enrolment_opens_on = today - dt.timedelta(days=7)
    enrolment_closes_on = today + dt.timedelta(days=21)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await PermissionService.ensure_permission_catalog(db)

        org = await one(db, Organisation, code="SHOOVA")
        if org is None:
            org = Organisation(
                name="Shoova Initiative",
                code="SHOOVA",
                description="Shoova Initiative organisational structure.",
            )
            db.add(org)
            await db.flush()

        department = await one(db, Department, organisation_id=org.id, code="ECB")
        if department is None:
            department = Department(
                organisation_id=org.id,
                name="Education & Capacity Building",
                code="ECB",
            )
            db.add(department)
            await db.flush()

        manager_person = await person(
            db,
            email=MANAGER_EMAIL,
            first_name="Ama",
            last_name="Mensah",
            type="staff",
            job_title="Programme Manager (Demo)",
        )
        mentor_person = await person(
            db,
            email=MENTOR_EMAIL,
            first_name="Kofi",
            last_name="Asare",
            type="volunteer",
            job_title="Community Mentor (Demo)",
        )
        learner = await person(
            db,
            email=LEARNER_EMAIL,
            first_name="Efua",
            last_name="Nyarko",
            type="beneficiary",
        )
        await user(
            db,
            person_record=manager_person,
            email=MANAGER_EMAIL,
            permissions=MANAGER_PERMISSIONS,
        )
        await user(
            db,
            person_record=mentor_person,
            email=MENTOR_EMAIL,
            permissions=MENTOR_PERMISSIONS,
        )

        programme = await one(db, Programme, code=PROGRAMME_CODE)
        if programme is None:
            programme = Programme(
                organisation_id=org.id,
                department_id=department.id,
                name="Environmental Stewardship",
                code=PROGRAMME_CODE,
                description=(
                    "Practical environmental stewardship for community learners: "
                    "field auditing, waste mapping and evidence-based reporting. "
                    "Fictional demo programme."
                ),
                status="active",
                start_date=cohort_start,
                end_date=cohort_end,
                level="Certificate",
                duration_weeks=7,
                learning_outcomes=(
                    "Learners conduct a community environmental audit, capture "
                    "geo-tagged evidence and present findings to a mentor."
                ),
                eligibility_requirements=(
                    "Open to community members in Accra. No prior environmental "
                    "experience is required. Applicants should be available for "
                    "weekly sessions and field activities."
                ),
                lead_id=manager_person.id,
            )
            db.add(programme)
            await db.flush()
        else:
            programme.start_date = cohort_start
            programme.end_date = cohort_end
            programme.eligibility_requirements = (
                "Open to community members in Accra. No prior environmental "
                "experience is required. Applicants should be available for "
                "weekly sessions and field activities."
            )

        course_specs = [
            (
                "ENV101",
                "Community Environmental Auditing",
                1,
                12,
                "Plan and carry out a structured neighbourhood environmental "
                "audit and document findings with geo-tagged evidence.",
            ),
            (
                "ENV102",
                "Waste Segregation & Recycling Practice",
                2,
                10,
                "Set up and run a community waste-segregation point and "
                "explain recycling pathways.",
            ),
        ]
        courses = {}
        for code, title, sequence, hours, outcomes in course_specs:
            course = await one(
                db, ProgrammeCourse, programme_id=programme.id, code=code
            )
            if course is None:
                course = ProgrammeCourse(
                    programme_id=programme.id,
                    code=code,
                    title=title,
                    sequence=sequence,
                    contact_hours=hours,
                    learning_outcomes=outcomes,
                )
                db.add(course)
                await db.flush()
            courses[code] = course

        cohort = await one(
            db, ProgrammeCohort, programme_id=programme.id, code=cohort_code
        )
        if cohort is None:
            cohort = ProgrammeCohort(
                programme_id=programme.id,
                name=cohort_name,
                code=cohort_code,
                start_date=cohort_start,
                end_date=cohort_end,
                enrolment_opens_on=enrolment_opens_on,
                enrolment_closes_on=enrolment_closes_on,
                capacity=15,
                delivery_mode="in_person",
                location="Osu Community Hub, Accra",
                status="enrolling",
                notes="Fictional pilot cohort for the learner workflow demo.",
            )
            db.add(cohort)
            await db.flush()
        else:
            cohort.name = cohort_name
            cohort.start_date = cohort_start
            cohort.end_date = cohort_end
            cohort.enrolment_opens_on = enrolment_opens_on
            cohort.enrolment_closes_on = enrolment_closes_on
            cohort.status = "enrolling"

        instructor = await one(
            db, CohortInstructor, cohort_id=cohort.id, person_id=mentor_person.id
        )
        if instructor is None:
            db.add(
                CohortInstructor(
                    cohort_id=cohort.id, person_id=mentor_person.id, role="lead"
                )
            )
            await db.flush()

        enrolment = await one(
            db, CohortEnrolment, cohort_id=cohort.id, person_id=learner.id
        )
        if enrolment is None:
            enrolment = CohortEnrolment(
                cohort_id=cohort.id,
                person_id=learner.id,
                status="enrolled",
                enrolled_on=cohort_start,
            )
            db.add(enrolment)
            await db.flush()
        else:
            enrolment.enrolled_on = cohort_start

        baseline = await one(db, LearnerBaseline, enrolment_id=enrolment.id)
        if baseline is None:
            db.add(
                LearnerBaseline(
                    enrolment_id=enrolment.id,
                    household_income_band="500_1000",
                    employment_status="unemployed",
                    can_afford_training="with_assistance",
                    device_access="shared",
                    internet_access="limited",
                    transport_constraints=(
                        "No direct transport to the field site; walks 40 minutes."
                    ),
                    education_status="shs",
                    household_dependents=2,
                    vulnerability_class="moderate",
                    notes="Fictional baseline for the local workflow demo.",
                    recorded_by=manager_person.id,
                    recorded_on=dt.date(2026, 11, 2),
                )
            )
            await db.flush()

        assignment = await one(
            db,
            ModuleAssignment,
            enrolment_id=enrolment.id,
            course_id=courses["ENV101"].id,
        )
        if assignment is None:
            assignment = ModuleAssignment(
                enrolment_id=enrolment.id,
                course_id=courses["ENV101"].id,
                competency=(
                    "Conduct a community environmental audit and document "
                    "findings with geo-tagged evidence."
                ),
                assigned_on=dt.date(2026, 11, 3),
                due_on=dt.date(2026, 11, 14),
                status="assigned",
                next_action="Complete the field audit task and submit evidence.",
            )
            db.add(assignment)
            await db.flush()

        task = await one(
            db,
            PracticalTask,
            assignment_id=assignment.id,
            title="Neighbourhood waste & drainage audit",
        )
        if task is None:
            task = PracticalTask(
                assignment_id=assignment.id,
                title="Neighbourhood waste & drainage audit",
                description=(
                    "Walk the audit route and record waste accumulation and "
                    "blocked drainage points."
                ),
                location="Anorhor Street area, Osu — Accra",
                instructions=(
                    "1. Walk the agreed route in pairs.\n"
                    "2. Photograph each waste or drainage point.\n"
                    "3. Capture GPS coordinates and a short field note per point.\n"
                    "4. Flag the three most urgent points for clean-up."
                ),
                safety_requirements=(
                    "Work in pairs; wear gloves; do not handle hazardous waste; "
                    "stay off the carriageway."
                ),
                expected_evidence=(
                    "Photos, field notes and GPS coordinates for at least "
                    "5 observation points."
                ),
                due_on=dt.date(2026, 11, 12),
                status="assigned",
            )
            db.add(task)
            await db.flush()

        if full:
            evidence = await one(db, EvidenceRecord, task_id=task.id)
            if evidence is None:
                evidence = EvidenceRecord(
                    task_id=task.id,
                    evidence_type="note",
                    field_notes=(
                        "Audited 12 points along Anorhor Street. 5 waste "
                        "accumulation points and 7 drainage points recorded; "
                        "3 flagged as urgent (market end, school wall, "
                        "junction drain)."
                    ),
                    reflection=(
                        "Mapping each point made the pattern clear — most "
                        "blockages sit downhill of the market. Next time I "
                        "would measure water flow after rain."
                    ),
                    gps_lat=5.5571,
                    gps_lng=-0.1819,
                    location_label="Anorhor Street, Osu — Accra",
                    recorded_on=dt.date(2026, 11, 5),
                    submitted_by=learner.id,
                )
                db.add(evidence)
                await db.flush()

            assessment = await one(db, MentorAssessment, evidence_id=evidence.id)
            if assessment is None:
                db.add(
                    MentorAssessment(
                        evidence_id=evidence.id,
                        mentor_id=mentor_person.id,
                        assessed_on=dt.date(2026, 11, 6),
                        competency_result="met",
                        feedback=(
                            "Audit covers all required observation points; "
                            "notes are specific and geo-tagged. Priority "
                            "ranking is well justified."
                        ),
                        evidence_quality="strong",
                    )
                )
                await db.flush()

            task.status = "completed"
            task.completed_on = dt.date(2026, 11, 6)
            assignment.status = "completed"
            assignment.completed_on = dt.date(2026, 11, 6)
            assignment.next_action = None
            enrolment.status = "completed"
            enrolment.completed_on = dt.date(2026, 11, 6)

            outcome = await one(db, LearnerOutcome, enrolment_id=enrolment.id)
            if outcome is None:
                outcome = LearnerOutcome(enrolment_id=enrolment.id)
                db.add(outcome)
            outcome.demonstrated_skills = (
                "Community environmental auditing; waste-point mapping; "
                "geo-tagged evidence capture."
            )
            outcome.field_outputs = (
                "Audit of 12 waste/drainage points on Anorhor Street; "
                "3 priority sites flagged for community clean-up."
            )
            outcome.further_training = (
                "ENV102 — Waste Segregation & Recycling Practice"
            )
            outcome.placement_status = "seeking"
            outcome.follow_up_status = "scheduled"
            outcome.follow_up_on = dt.date(2026, 12, 7)
            outcome.notes = "Fictional demo outcome."
            await db.flush()

        await db.commit()

        print("\nDemo seed complete (local SQLite only — all records fictional).")
        print(f"  Programme : {programme.name} [{PROGRAMME_CODE}]")
        print(f"  Cohort    : {cohort.name} [{cohort_code}]")
        print(f"  Learner   : {learner.first_name} {learner.last_name}")
        print(f"  Stage     : {'FULL journey (evidence -> assessment -> outcome)' if full else 'start of journey (drive it live)'}")
        print("\nAccounts (password: " + DEMO_PASSWORD + "):")
        print(f"  {MANAGER_EMAIL}  — manager: full workflow + baseline")
        print(f"  {MENTOR_EMAIL}   — mentor: assess only, no baseline access")
        print("\nFrontend paths (after login):")
        print(f"  Journey   : /programmes/enrolments/{enrolment.id}/journey")
        print(f"  Dashboard : /programmes/cohorts/{cohort.id}/dashboard")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--full",
        action="store_true",
        help="Complete the journey: evidence, mentor assessment and outcome.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.full))
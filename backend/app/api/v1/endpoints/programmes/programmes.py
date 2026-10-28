from datetime import date, datetime
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import Permissions, require_permission
from app.models.sql.core.organisation import Department, Organisation, Programme
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
    CohortInstructor,
    EnrolmentResult,
    ProgrammeCohort,
    ProgrammeCourse,
)
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService

router = APIRouter()

PROGRAMME_LEVELS = {
    "certificate",
    "diploma",
    "degree",
    "short_course",
    "other",
}
PROGRAMME_STATUSES = {"draft", "active", "completed", "archived"}
PROGRAMME_STATUS_TRANSITIONS = {
    "draft": {"active", "archived"},
    "active": {"completed", "archived"},
    "completed": {"archived"},
    "archived": set(),
}
COHORT_STATUSES = {
    "planned",
    "enrolling",
    "active",
    "completed",
    "cancelled",
}
DELIVERY_MODES = {"in_person", "online", "hybrid"}
INSTRUCTOR_ROLES = {"lead", "instructor"}
ENROLMENT_STATUSES = {"enrolled", "completed", "withdrawn"}
RESULT_STATUSES = {"pending", "passed", "failed"}


# ============================================================
# SCHEMAS
# ============================================================

class PersonBrief(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    profile_image_url: Optional[str] = None


class CourseItem(BaseModel):
    id: str
    code: Optional[str] = None
    title: str
    description: Optional[str] = None
    sequence: int
    contact_hours: Optional[int] = None
    learning_outcomes: Optional[str] = None
    is_optional: bool


class CohortSummary(BaseModel):
    id: str
    programme_id: str
    name: str
    code: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    capacity: Optional[int] = None
    delivery_mode: str
    location: Optional[str] = None
    status: str
    enrolled_count: int
    instructor_count: int


class ProgrammeSummary(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str
    level: Optional[str] = None
    duration_weeks: Optional[int] = None
    organisation_id: str
    organisation_name: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    lead: Optional[PersonBrief] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    course_count: int
    cohort_count: int
    learner_count: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProgrammeDetail(ProgrammeSummary):
    learning_outcomes: Optional[str] = None
    courses: List[CourseItem] = []
    cohorts: List[CohortSummary] = []


class ResultItem(BaseModel):
    course_id: str
    course_title: str
    score: Optional[float] = None
    grade: Optional[str] = None
    status: str


class EnrolmentItem(BaseModel):
    id: str
    person: PersonBrief
    status: str
    enrolled_on: Optional[date] = None
    completed_on: Optional[date] = None
    notes: Optional[str] = None
    results: List[ResultItem] = []


class InstructorItem(BaseModel):
    person: PersonBrief
    role: str


class CohortDetail(CohortSummary):
    programme_name: str
    notes: Optional[str] = None
    enrolment_opens_on: Optional[date] = None
    enrolment_closes_on: Optional[date] = None
    courses: List[CourseItem] = []
    instructors: List[InstructorItem] = []
    enrolments: List[EnrolmentItem] = []


class ProgrammeCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    organisation_id: str
    department_id: Optional[str] = None
    level: Optional[str] = Field(None, max_length=30)
    duration_weeks: Optional[int] = Field(None, ge=1, le=520)
    learning_outcomes: Optional[str] = None
    lead_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("level")
    @classmethod
    def valid_level(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PROGRAMME_LEVELS:
            raise ValueError(f"must be one of {sorted(PROGRAMME_LEVELS)}")
        return value


class ProgrammeUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    department_id: Optional[str] = None
    level: Optional[str] = Field(None, max_length=30)
    duration_weeks: Optional[int] = Field(None, ge=1, le=520)
    learning_outcomes: Optional[str] = None
    lead_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("level")
    @classmethod
    def valid_level(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in PROGRAMME_LEVELS:
            raise ValueError(f"must be one of {sorted(PROGRAMME_LEVELS)}")
        return value


class StatusChangeRequest(BaseModel):
    status: str = Field(..., max_length=30)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in PROGRAMME_STATUSES:
            raise ValueError(f"must be one of {sorted(PROGRAMME_STATUSES)}")
        return value


class CourseCreateRequest(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    sequence: Optional[int] = Field(None, ge=0)
    contact_hours: Optional[int] = Field(None, ge=0, le=2000)
    learning_outcomes: Optional[str] = None
    is_optional: bool = False


class CourseUpdateRequest(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    sequence: Optional[int] = Field(None, ge=0)
    contact_hours: Optional[int] = Field(None, ge=0, le=2000)
    learning_outcomes: Optional[str] = None
    is_optional: Optional[bool] = None


class CourseOrderRequest(BaseModel):
    course_ids: List[str] = Field(..., min_length=1)


class CohortCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    enrolment_opens_on: Optional[date] = None
    enrolment_closes_on: Optional[date] = None
    capacity: Optional[int] = Field(None, ge=1, le=10000)
    delivery_mode: str = Field("in_person", max_length=20)
    location: Optional[str] = Field(None, max_length=255)
    status: str = Field("planned", max_length=30)
    notes: Optional[str] = None

    @field_validator("delivery_mode")
    @classmethod
    def valid_mode(cls, value: str) -> str:
        if value not in DELIVERY_MODES:
            raise ValueError(f"must be one of {sorted(DELIVERY_MODES)}")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in COHORT_STATUSES:
            raise ValueError(f"must be one of {sorted(COHORT_STATUSES)}")
        return value


class CohortUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    enrolment_opens_on: Optional[date] = None
    enrolment_closes_on: Optional[date] = None
    capacity: Optional[int] = Field(None, ge=1, le=10000)
    delivery_mode: Optional[str] = Field(None, max_length=20)
    location: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, max_length=30)
    notes: Optional[str] = None

    @field_validator("delivery_mode")
    @classmethod
    def valid_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in DELIVERY_MODES:
            raise ValueError(f"must be one of {sorted(DELIVERY_MODES)}")
        return value

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in COHORT_STATUSES:
            raise ValueError(f"must be one of {sorted(COHORT_STATUSES)}")
        return value


class InstructorRequest(BaseModel):
    person_id: str
    role: str = Field("instructor", max_length=20)

    @field_validator("role")
    @classmethod
    def valid_role(cls, value: str) -> str:
        if value not in INSTRUCTOR_ROLES:
            raise ValueError(f"must be one of {sorted(INSTRUCTOR_ROLES)}")
        return value


class EnrolRequest(BaseModel):
    person_ids: List[str] = Field(..., min_length=1)
    enrolled_on: Optional[date] = None


class EnrolmentUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, max_length=20)
    completed_on: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ENROLMENT_STATUSES:
            raise ValueError(f"must be one of {sorted(ENROLMENT_STATUSES)}")
        return value


class ResultRequest(BaseModel):
    score: Optional[float] = Field(None, ge=0, le=100)
    grade: Optional[str] = Field(None, max_length=20)
    status: str = Field("pending", max_length=20)

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str) -> str:
        if value not in RESULT_STATUSES:
            raise ValueError(f"must be one of {sorted(RESULT_STATUSES)}")
        return value


# ============================================================
# HELPERS
# ============================================================

def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _audit_scalar(value):
    """Dates serialise for the audit log; everything else passes through."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def _person_brief(person: Optional[Person]) -> PersonBrief:
    if not person:
        return PersonBrief(id="", first_name="Unknown", last_name="")
    return PersonBrief(
        id=str(person.id),
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        profile_image_url=person.profile_image_url,
    )


def _course_item(course: ProgrammeCourse) -> CourseItem:
    return CourseItem(
        id=str(course.id),
        code=course.code,
        title=course.title,
        description=course.description,
        sequence=course.sequence,
        contact_hours=course.contact_hours,
        learning_outcomes=course.learning_outcomes,
        is_optional=course.is_optional,
    )


async def _can_manage(db: AsyncSession, user: User) -> bool:
    return await PermissionService.has_permission(
        db, user.id, Permissions.PROGRAMMES_EDIT
    )


async def _load_programme(
    db: AsyncSession,
    programme_id: str,
) -> Programme:
    result = await db.execute(
        select(Programme).where(Programme.id == programme_id)
    )
    programme = result.scalar_one_or_none()
    if not programme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme not found",
        )
    return programme


async def _require_visible(
    db: AsyncSession,
    programme: Programme,
    user: User,
) -> None:
    if programme.status == "draft" and not await _can_manage(db, user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Programme not found",
        )


async def _load_cohort(
    db: AsyncSession,
    cohort_id: str,
) -> ProgrammeCohort:
    result = await db.execute(
        select(ProgrammeCohort)
        .where(ProgrammeCohort.id == cohort_id)
        .execution_options(populate_existing=True)
    )
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort not found",
        )
    return cohort


async def _load_enrolment(
    db: AsyncSession,
    enrolment_id: str,
) -> CohortEnrolment:
    result = await db.execute(
        select(CohortEnrolment).where(CohortEnrolment.id == enrolment_id)
    )
    enrolment = result.scalar_one_or_none()
    if not enrolment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrolment not found",
        )
    return enrolment


async def _valid_person_ids(
    db: AsyncSession,
    person_ids: List[str],
) -> List[str]:
    ids: List[str] = []
    for raw in person_ids:
        value = _clean(raw)
        if value and value not in ids:
            ids.append(value)
    if not ids:
        return []

    result = await db.execute(
        select(Person.id).where(
            Person.id.in_(ids),
            Person.deleted_at.is_(None),
        )
    )
    found = {str(row[0]) for row in result}
    missing = [value for value in ids if value not in found]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown person(s): {', '.join(missing)}",
        )
    return ids


def _validate_dates(
    start: Optional[date],
    end: Optional[date],
    *,
    label: str = "end_date",
    start_label: str = "start_date",
) -> None:
    if start and end and end < start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} cannot be before {start_label}",
        )


async def _course_counts(
    db: AsyncSession,
    programme_ids: List[str],
) -> dict:
    if not programme_ids:
        return {}
    rows = await db.execute(
        select(
            ProgrammeCourse.programme_id,
            func.count(ProgrammeCourse.id),
        )
        .where(ProgrammeCourse.programme_id.in_(programme_ids))
        .group_by(ProgrammeCourse.programme_id)
    )
    return {str(pid): count for pid, count in rows}


async def _cohort_counts(
    db: AsyncSession,
    programme_ids: List[str],
) -> dict:
    if not programme_ids:
        return {}
    rows = await db.execute(
        select(
            ProgrammeCohort.programme_id,
            func.count(ProgrammeCohort.id),
        )
        .where(ProgrammeCohort.programme_id.in_(programme_ids))
        .group_by(ProgrammeCohort.programme_id)
    )
    return {str(pid): count for pid, count in rows}


async def _learner_counts(
    db: AsyncSession,
    programme_ids: List[str],
) -> dict:
    if not programme_ids:
        return {}
    rows = await db.execute(
        select(
            ProgrammeCohort.programme_id,
            func.count(CohortEnrolment.id),
        )
        .join(
            CohortEnrolment,
            CohortEnrolment.cohort_id == ProgrammeCohort.id,
        )
        .where(
            ProgrammeCohort.programme_id.in_(programme_ids),
            CohortEnrolment.status != "withdrawn",
        )
        .group_by(ProgrammeCohort.programme_id)
    )
    return {str(pid): count for pid, count in rows}


async def _cohort_stats(
    db: AsyncSession,
    cohort_ids: List[str],
) -> tuple:
    """Return (enrolled_counts, instructor_counts) keyed by cohort id."""
    enrolled: dict = {}
    instructors: dict = {}
    if not cohort_ids:
        return enrolled, instructors

    rows = await db.execute(
        select(
            CohortEnrolment.cohort_id,
            CohortEnrolment.status,
            func.count(CohortEnrolment.id),
        )
        .where(CohortEnrolment.cohort_id.in_(cohort_ids))
        .group_by(CohortEnrolment.cohort_id, CohortEnrolment.status)
    )
    for cohort_id, enrolment_status, count in rows:
        if enrolment_status == "withdrawn":
            continue
        key = str(cohort_id)
        enrolled[key] = enrolled.get(key, 0) + count

    rows = await db.execute(
        select(
            CohortInstructor.cohort_id,
            func.count(CohortInstructor.id),
        )
        .where(CohortInstructor.cohort_id.in_(cohort_ids))
        .group_by(CohortInstructor.cohort_id)
    )
    for cohort_id, count in rows:
        instructors[str(cohort_id)] = count

    return enrolled, instructors


def _cohort_summary(
    cohort: ProgrammeCohort,
    *,
    enrolled_count: int = 0,
    instructor_count: int = 0,
) -> CohortSummary:
    return CohortSummary(
        id=str(cohort.id),
        programme_id=str(cohort.programme_id),
        name=cohort.name,
        code=cohort.code,
        start_date=cohort.start_date,
        end_date=cohort.end_date,
        capacity=cohort.capacity,
        delivery_mode=cohort.delivery_mode,
        location=cohort.location,
        status=cohort.status,
        enrolled_count=enrolled_count,
        instructor_count=instructor_count,
    )


def _summary(
    programme: Programme,
    *,
    course_count: int = 0,
    cohort_count: int = 0,
    learner_count: int = 0,
) -> ProgrammeSummary:
    return ProgrammeSummary(
        id=str(programme.id),
        name=programme.name,
        code=programme.code,
        description=programme.description,
        status=programme.status,
        level=programme.level,
        duration_weeks=programme.duration_weeks,
        organisation_id=str(programme.organisation_id),
        organisation_name=(
            programme.organisation.name if programme.organisation else None
        ),
        department_id=(
            str(programme.department_id)
            if programme.department_id
            else None
        ),
        department_name=(
            programme.department.name if programme.department else None
        ),
        lead=_person_brief(programme.lead) if programme.lead else None,
        start_date=programme.start_date,
        end_date=programme.end_date,
        course_count=course_count,
        cohort_count=cohort_count,
        learner_count=learner_count,
        created_at=_iso(programme.created_at),
        updated_at=_iso(programme.updated_at),
    )


async def _programme_detail(
    db: AsyncSession,
    programme: Programme,
) -> ProgrammeDetail:
    courses = (
        await db.execute(
            select(ProgrammeCourse)
            .where(ProgrammeCourse.programme_id == programme.id)
            .order_by(ProgrammeCourse.sequence, ProgrammeCourse.title)
        )
    ).scalars().all()

    cohorts = (
        await db.execute(
            select(ProgrammeCohort)
            .where(ProgrammeCohort.programme_id == programme.id)
            .order_by(ProgrammeCohort.start_date, ProgrammeCohort.name)
        )
    ).scalars().all()

    cohort_ids = [str(cohort.id) for cohort in cohorts]
    enrolled_counts, instructor_counts = await _cohort_stats(
        db, cohort_ids
    )

    cohort_items = [
        _cohort_summary(
            cohort,
            enrolled_count=enrolled_counts.get(str(cohort.id), 0),
            instructor_count=instructor_counts.get(str(cohort.id), 0),
        )
        for cohort in cohorts
    ]

    base = _summary(
        programme,
        course_count=len(courses),
        cohort_count=len(cohorts),
        learner_count=sum(
            item.enrolled_count for item in cohort_items
        ),
    )

    return ProgrammeDetail(
        **base.model_dump(),
        learning_outcomes=programme.learning_outcomes,
        courses=[_course_item(course) for course in courses],
        cohorts=cohort_items,
    )


async def _cohort_detail(
    db: AsyncSession,
    cohort: ProgrammeCohort,
) -> CohortDetail:
    programme = cohort.programme

    courses = (
        await db.execute(
            select(ProgrammeCourse)
            .where(ProgrammeCourse.programme_id == cohort.programme_id)
            .order_by(ProgrammeCourse.sequence, ProgrammeCourse.title)
        )
    ).scalars().all()

    instructors = (
        await db.execute(
            select(CohortInstructor)
            .where(CohortInstructor.cohort_id == cohort.id)
            .order_by(CohortInstructor.created_at)
        )
    ).scalars().all()

    enrolments = (
        await db.execute(
            select(CohortEnrolment)
            .where(CohortEnrolment.cohort_id == cohort.id)
            .order_by(
                CohortEnrolment.enrolled_on,
                CohortEnrolment.created_at,
            )
            .execution_options(populate_existing=True)
        )
    ).scalars().all()

    results_by_enrolment: dict = {}
    if enrolments:
        rows = await db.execute(
            select(
                EnrolmentResult,
                ProgrammeCourse.title,
            )
            .join(
                ProgrammeCourse,
                ProgrammeCourse.id == EnrolmentResult.course_id,
            )
            .where(
                EnrolmentResult.enrolment_id.in_(
                    [str(item.id) for item in enrolments]
                )
            )
            .order_by(ProgrammeCourse.sequence)
        )
        for result, course_title in rows:
            results_by_enrolment.setdefault(
                str(result.enrolment_id), []
            ).append(
                ResultItem(
                    course_id=str(result.course_id),
                    course_title=course_title,
                    score=result.score,
                    grade=result.grade,
                    status=result.status,
                )
            )

    enrolled_count = sum(
        1 for item in enrolments if item.status != "withdrawn"
    )

    return CohortDetail(
        **_cohort_summary(
            cohort,
            enrolled_count=enrolled_count,
            instructor_count=len(instructors),
        ).model_dump(),
        programme_name=programme.name if programme else "",
        notes=cohort.notes,
        enrolment_opens_on=cohort.enrolment_opens_on,
        enrolment_closes_on=cohort.enrolment_closes_on,
        courses=[_course_item(course) for course in courses],
        instructors=[
            InstructorItem(
                person=_person_brief(instructor.person),
                role=instructor.role,
            )
            for instructor in instructors
        ],
        enrolments=[
            EnrolmentItem(
                id=str(item.id),
                person=_person_brief(item.person),
                status=item.status,
                enrolled_on=item.enrolled_on,
                completed_on=item.completed_on,
                notes=item.notes,
                results=results_by_enrolment.get(str(item.id), []),
            )
            for item in enrolments
        ],
    )


async def _ensure_course_code_free(
    db: AsyncSession,
    programme_id: str,
    code: Optional[str],
    *,
    exclude_id: Optional[str] = None,
) -> None:
    if not code:
        return
    query = select(ProgrammeCourse.id).where(
        ProgrammeCourse.programme_id == programme_id,
        ProgrammeCourse.code == code,
    )
    if exclude_id:
        query = query.where(ProgrammeCourse.id != exclude_id)
    if (await db.execute(query)).scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A course with this code already exists in the programme",
        )


async def _ensure_cohort_code_free(
    db: AsyncSession,
    programme_id: str,
    code: Optional[str],
    *,
    exclude_id: Optional[str] = None,
) -> None:
    if not code:
        return
    query = select(ProgrammeCohort.id).where(
        ProgrammeCohort.programme_id == programme_id,
        ProgrammeCohort.code == code,
    )
    if exclude_id:
        query = query.where(ProgrammeCohort.id != exclude_id)
    if (await db.execute(query)).scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A cohort with this code already exists in the programme",
        )


# ============================================================
# PROGRAMME LIST / CREATE
# ============================================================

@router.get("", response_model=List[ProgrammeSummary])
async def list_programmes(
    status_filter: Optional[str] = Query(None, alias="status"),
    level: Optional[str] = None,
    department_id: Optional[str] = None,
    organisation_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_VIEW)
    ),
):
    """List programmes. Drafts stay hidden from non-managers."""
    query = select(Programme)

    if not await _can_manage(db, current_user):
        query = query.where(Programme.status != "draft")

    if status_filter:
        if status_filter not in PROGRAMME_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"status must be one of {sorted(PROGRAMME_STATUSES)}",
            )
        query = query.where(Programme.status == status_filter)
    if level:
        query = query.where(Programme.level == level)
    if department_id:
        query = query.where(Programme.department_id == department_id)
    if organisation_id:
        query = query.where(
            Programme.organisation_id == organisation_id
        )
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Programme.name.ilike(pattern),
                Programme.code.ilike(pattern),
                Programme.description.ilike(pattern),
            )
        )

    query = (
        query.order_by(Programme.name.asc())
        .offset(offset)
        .limit(limit)
    )

    programmes = (await db.execute(query)).scalars().all()
    ids = [str(programme.id) for programme in programmes]

    courses = await _course_counts(db, ids)
    cohorts = await _cohort_counts(db, ids)
    learners = await _learner_counts(db, ids)

    return [
        _summary(
            programme,
            course_count=courses.get(str(programme.id), 0),
            cohort_count=cohorts.get(str(programme.id), 0),
            learner_count=learners.get(str(programme.id), 0),
        )
        for programme in programmes
    ]


@router.post(
    "",
    response_model=ProgrammeDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_programme(
    payload: ProgrammeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_CREATE)
    ),
):
    """Create a programme as a draft. Curriculum is added afterwards."""
    organisation = await db.get(Organisation, payload.organisation_id)
    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organisation not found",
        )

    department_id = _clean(payload.department_id)
    if department_id:
        department = await db.get(Department, department_id)
        if not department or str(department.organisation_id) != str(
            organisation.id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department does not belong to the organisation",
            )

    lead_id = _clean(payload.lead_id)
    if lead_id:
        lead = await db.get(Person, lead_id)
        if not lead or lead.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Programme lead not found",
            )

    code = _clean(payload.code)
    if code:
        existing = await db.execute(
            select(Programme.id).where(
                Programme.organisation_id == organisation.id,
                Programme.code == code,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Programme code already exists in this organisation",
            )

    _validate_dates(payload.start_date, payload.end_date)

    programme = Programme(
        id=str(uuid.uuid4()),
        organisation_id=organisation.id,
        department_id=department_id,
        name=payload.name.strip(),
        code=code,
        description=payload.description,
        status="draft",
        level=payload.level,
        duration_weeks=payload.duration_weeks,
        learning_outcomes=payload.learning_outcomes,
        lead_id=lead_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )

    db.add(programme)
    await db.flush()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_CREATED",
        entity_type="programme",
        entity_id=programme.id,
        description=f"Created programme {programme.name}",
        new_values={
            "name": programme.name,
            "code": programme.code,
            "level": programme.level,
        },
    )

    await db.commit()

    result = await db.execute(
        select(Programme)
        .where(Programme.id == programme.id)
        .execution_options(populate_existing=True)
    )
    programme = result.scalar_one()

    return await _programme_detail(db, programme)


# ============================================================
# COHORTS AND ENROLMENTS (static prefixes before /{programme_id})
# ============================================================

@router.get("/cohorts/{cohort_id}", response_model=CohortDetail)
async def get_cohort(
    cohort_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_VIEW)
    ),
):
    cohort = await _load_cohort(db, cohort_id)
    await _require_visible(db, cohort.programme, current_user)
    return await _cohort_detail(db, cohort)


@router.patch("/cohorts/{cohort_id}", response_model=CohortDetail)
async def update_cohort(
    cohort_id: str,
    payload: CohortUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    cohort = await _load_cohort(db, cohort_id)

    changes = payload.model_dump(exclude_unset=True)

    for key in ("code", "location"):
        if key in changes:
            changes[key] = _clean(changes[key])

    if "code" in changes:
        await _ensure_cohort_code_free(
            db,
            str(cohort.programme_id),
            changes["code"],
            exclude_id=str(cohort.id),
        )

    start = changes.get("start_date", cohort.start_date)
    end = changes.get("end_date", cohort.end_date)
    _validate_dates(start, end)

    opens = changes.get(
        "enrolment_opens_on", cohort.enrolment_opens_on
    )
    closes = changes.get(
        "enrolment_closes_on", cohort.enrolment_closes_on
    )
    _validate_dates(
        opens,
        closes,
        label="enrolment_closes_on",
        start_label="enrolment_opens_on",
    )

    if "capacity" in changes and changes["capacity"] is not None:
        occupied = (
            await db.execute(
                select(func.count(CohortEnrolment.id)).where(
                    CohortEnrolment.cohort_id == cohort.id,
                    CohortEnrolment.status != "withdrawn",
                )
            )
        ).scalar_one()
        if changes["capacity"] < occupied:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Capacity cannot be below the {occupied} learner(s) "
                    "already on this cohort"
                ),
            )

    old_values = {}
    for key, value in changes.items():
        old_values[key] = _audit_scalar(getattr(cohort, key, None))
        setattr(cohort, key, value)

    if changes:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="PROGRAMME_COHORT_UPDATED",
            entity_type="programme_cohort",
            entity_id=cohort.id,
            description=f"Updated cohort {cohort.name}",
            old_values=old_values,
        )

    await db.commit()
    cohort = await _load_cohort(db, cohort.id)
    return await _cohort_detail(db, cohort)


@router.post(
    "/cohorts/{cohort_id}/instructors",
    response_model=CohortDetail,
)
async def add_instructor(
    cohort_id: str,
    payload: InstructorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    cohort = await _load_cohort(db, cohort_id)
    person_ids = await _valid_person_ids(db, [payload.person_id])
    person_id = person_ids[0]

    existing = await db.execute(
        select(CohortInstructor.id).where(
            CohortInstructor.cohort_id == cohort.id,
            CohortInstructor.person_id == person_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This person is already on the cohort",
        )

    db.add(
        CohortInstructor(
            cohort_id=cohort.id,
            person_id=person_id,
            role=payload.role,
        )
    )

    await AuditService.log(
        db=db,
        actor=current_user,
        action="COHORT_INSTRUCTOR_ADDED",
        entity_type="programme_cohort",
        entity_id=cohort.id,
        description=f"Added an instructor to {cohort.name}",
        new_values={"person_id": person_id, "role": payload.role},
    )

    await db.commit()
    cohort = await _load_cohort(db, cohort.id)
    return await _cohort_detail(db, cohort)


@router.delete(
    "/cohorts/{cohort_id}/instructors/{person_id}",
    response_model=CohortDetail,
)
async def remove_instructor(
    cohort_id: str,
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    cohort = await _load_cohort(db, cohort_id)

    result = await db.execute(
        select(CohortInstructor).where(
            CohortInstructor.cohort_id == cohort.id,
            CohortInstructor.person_id == person_id,
        )
    )
    instructor = result.scalar_one_or_none()
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found on this cohort",
        )

    await db.delete(instructor)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="COHORT_INSTRUCTOR_REMOVED",
        entity_type="programme_cohort",
        entity_id=cohort.id,
        description=f"Removed an instructor from {cohort.name}",
        old_values={"person_id": person_id},
    )

    await db.commit()
    cohort = await _load_cohort(db, cohort.id)
    return await _cohort_detail(db, cohort)


@router.post(
    "/cohorts/{cohort_id}/enrolments",
    response_model=CohortDetail,
)
async def enrol_learners(
    cohort_id: str,
    payload: EnrolRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    cohort = await _load_cohort(db, cohort_id)

    if cohort.status in {"completed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This cohort is closed for enrolment",
        )

    person_ids = await _valid_person_ids(db, payload.person_ids)

    existing = {
        str(row[0])
        for row in await db.execute(
            select(CohortEnrolment.person_id).where(
                CohortEnrolment.cohort_id == cohort.id
            )
        )
    }
    new_ids = [value for value in person_ids if value not in existing]

    if cohort.capacity is not None and new_ids:
        occupied = (
            await db.execute(
                select(func.count(CohortEnrolment.id)).where(
                    CohortEnrolment.cohort_id == cohort.id,
                    CohortEnrolment.status != "withdrawn",
                )
            )
        ).scalar_one()
        if occupied + len(new_ids) > cohort.capacity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Capacity is {cohort.capacity}; "
                    f"{occupied} place(s) already taken"
                ),
            )

    enrolled_on = payload.enrolled_on or date.today()
    for person_id in new_ids:
        db.add(
            CohortEnrolment(
                cohort_id=cohort.id,
                person_id=person_id,
                status="enrolled",
                enrolled_on=enrolled_on,
            )
        )

    if new_ids:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="COHORT_ENROLMENTS_ADDED",
            entity_type="programme_cohort",
            entity_id=cohort.id,
            description=(
                f"Enrolled {len(new_ids)} learner(s) on {cohort.name}"
            ),
            new_values={"person_ids": new_ids},
        )
        await db.commit()

    cohort = await _load_cohort(db, cohort.id)
    return await _cohort_detail(db, cohort)


@router.patch(
    "/enrolments/{enrolment_id}",
    response_model=EnrolmentItem,
)
async def update_enrolment(
    enrolment_id: str,
    payload: EnrolmentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    enrolment = await _load_enrolment(db, enrolment_id)

    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") == "completed" and not changes.get(
        "completed_on"
    ) and not enrolment.completed_on:
        changes["completed_on"] = date.today()

    for key, value in changes.items():
        setattr(enrolment, key, value)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="COHORT_ENROLMENT_UPDATED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description="Updated a learner enrolment",
        new_values={
            key: _iso(value) if isinstance(value, date) else value
            for key, value in changes.items()
        },
    )

    await db.commit()

    result = await db.execute(
        select(CohortEnrolment)
        .where(CohortEnrolment.id == enrolment.id)
        .execution_options(populate_existing=True)
    )
    enrolment = result.scalar_one()

    results = (
        await db.execute(
            select(EnrolmentResult, ProgrammeCourse.title)
            .join(
                ProgrammeCourse,
                ProgrammeCourse.id == EnrolmentResult.course_id,
            )
            .where(EnrolmentResult.enrolment_id == enrolment.id)
            .order_by(ProgrammeCourse.sequence)
        )
    ).all()

    return EnrolmentItem(
        id=str(enrolment.id),
        person=_person_brief(enrolment.person),
        status=enrolment.status,
        enrolled_on=enrolment.enrolled_on,
        completed_on=enrolment.completed_on,
        notes=enrolment.notes,
        results=[
            ResultItem(
                course_id=str(result.course_id),
                course_title=title,
                score=result.score,
                grade=result.grade,
                status=result.status,
            )
            for result, title in results
        ],
    )


@router.delete(
    "/enrolments/{enrolment_id}",
    response_model=CohortDetail,
)
async def remove_enrolment(
    enrolment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    enrolment = await _load_enrolment(db, enrolment_id)
    cohort_id = enrolment.cohort_id

    await db.delete(enrolment)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="COHORT_ENROLMENT_REMOVED",
        entity_type="cohort_enrolment",
        entity_id=enrolment_id,
        description="Removed a learner from a cohort",
        old_values={"person_id": str(enrolment.person_id)},
    )

    await db.commit()
    cohort = await _load_cohort(db, str(cohort_id))
    return await _cohort_detail(db, cohort)


@router.put(
    "/enrolments/{enrolment_id}/results/{course_id}",
    response_model=EnrolmentItem,
)
async def record_result(
    enrolment_id: str,
    course_id: str,
    payload: ResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    enrolment = await _load_enrolment(db, enrolment_id)
    cohort = await _load_cohort(db, str(enrolment.cohort_id))

    course = await db.get(ProgrammeCourse, course_id)
    if not course or str(course.programme_id) != str(
        cohort.programme_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course does not belong to this programme",
        )

    result = (
        await db.execute(
            select(EnrolmentResult).where(
                EnrolmentResult.enrolment_id == enrolment.id,
                EnrolmentResult.course_id == course.id,
            )
        )
    ).scalar_one_or_none()

    if not result:
        result = EnrolmentResult(
            enrolment_id=enrolment.id,
            course_id=course.id,
        )
        db.add(result)

    result.score = payload.score
    result.grade = _clean(payload.grade)
    result.status = payload.status

    await AuditService.log(
        db=db,
        actor=current_user,
        action="ENROLMENT_RESULT_RECORDED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description=f"Recorded a result for {course.title}",
        new_values={
            "course_id": str(course.id),
            "score": payload.score,
            "grade": payload.grade,
            "status": payload.status,
        },
    )

    await db.commit()

    results = (
        await db.execute(
            select(EnrolmentResult, ProgrammeCourse.title)
            .join(
                ProgrammeCourse,
                ProgrammeCourse.id == EnrolmentResult.course_id,
            )
            .where(EnrolmentResult.enrolment_id == enrolment.id)
            .order_by(ProgrammeCourse.sequence)
        )
    ).all()

    return EnrolmentItem(
        id=str(enrolment.id),
        person=_person_brief(enrolment.person),
        status=enrolment.status,
        enrolled_on=enrolment.enrolled_on,
        completed_on=enrolment.completed_on,
        notes=enrolment.notes,
        results=[
            ResultItem(
                course_id=str(row.course_id),
                course_title=title,
                score=row.score,
                grade=row.grade,
                status=row.status,
            )
            for row, title in results
        ],
    )


@router.delete(
    "/enrolments/{enrolment_id}/results/{course_id}",
    response_model=EnrolmentItem,
)
async def remove_result(
    enrolment_id: str,
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    enrolment = await _load_enrolment(db, enrolment_id)

    result = (
        await db.execute(
            select(EnrolmentResult).where(
                EnrolmentResult.enrolment_id == enrolment.id,
                EnrolmentResult.course_id == course_id,
            )
        )
    ).scalar_one_or_none()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result not found",
        )

    await db.delete(result)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="ENROLMENT_RESULT_REMOVED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description="Removed a course result",
        old_values={"course_id": course_id},
    )

    await db.commit()

    results = (
        await db.execute(
            select(EnrolmentResult, ProgrammeCourse.title)
            .join(
                ProgrammeCourse,
                ProgrammeCourse.id == EnrolmentResult.course_id,
            )
            .where(EnrolmentResult.enrolment_id == enrolment.id)
            .order_by(ProgrammeCourse.sequence)
        )
    ).all()

    return EnrolmentItem(
        id=str(enrolment.id),
        person=_person_brief(enrolment.person),
        status=enrolment.status,
        enrolled_on=enrolment.enrolled_on,
        completed_on=enrolment.completed_on,
        notes=enrolment.notes,
        results=[
            ResultItem(
                course_id=str(row.course_id),
                course_title=title,
                score=row.score,
                grade=row.grade,
                status=row.status,
            )
            for row, title in results
        ],
    )


# ============================================================
# PROGRAMME DETAIL / UPDATE / STATUS
# ============================================================

@router.get("/{programme_id}", response_model=ProgrammeDetail)
async def get_programme(
    programme_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_VIEW)
    ),
):
    programme = await _load_programme(db, programme_id)
    await _require_visible(db, programme, current_user)
    return await _programme_detail(db, programme)


@router.patch("/{programme_id}", response_model=ProgrammeDetail)
async def update_programme(
    programme_id: str,
    payload: ProgrammeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)
    changes = payload.model_dump(exclude_unset=True)

    for key in ("code", "department_id", "lead_id"):
        if key in changes:
            changes[key] = _clean(changes[key])

    if "code" in changes and changes["code"]:
        existing = await db.execute(
            select(Programme.id).where(
                Programme.organisation_id == programme.organisation_id,
                Programme.code == changes["code"],
                Programme.id != programme.id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Programme code already exists in this organisation",
            )

    if changes.get("department_id"):
        department = await db.get(
            Department, changes["department_id"]
        )
        if not department or str(department.organisation_id) != str(
            programme.organisation_id
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Department does not belong to the organisation",
            )

    if changes.get("lead_id"):
        lead = await db.get(Person, changes["lead_id"])
        if not lead or lead.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Programme lead not found",
            )

    start = changes.get("start_date", programme.start_date)
    end = changes.get("end_date", programme.end_date)
    _validate_dates(start, end)

    old_values = {}
    for key, value in changes.items():
        if key == "name" and value:
            value = value.strip()
        old_values[key] = _audit_scalar(getattr(programme, key, None))
        setattr(programme, key, value)

    if changes:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="PROGRAMME_UPDATED",
            entity_type="programme",
            entity_id=programme.id,
            description=f"Updated programme {programme.name}",
            old_values=old_values,
        )

    await db.commit()

    result = await db.execute(
        select(Programme)
        .where(Programme.id == programme.id)
        .execution_options(populate_existing=True)
    )
    programme = result.scalar_one()
    return await _programme_detail(db, programme)


@router.post("/{programme_id}/status", response_model=ProgrammeDetail)
async def change_programme_status(
    programme_id: str,
    payload: StatusChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)
    target = payload.status

    if target == programme.status:
        return await _programme_detail(db, programme)

    allowed = PROGRAMME_STATUS_TRANSITIONS.get(programme.status, set())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A {programme.status} programme cannot become {target}"
            ),
        )

    old_status = programme.status
    programme.status = target

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_STATUS_CHANGED",
        entity_type="programme",
        entity_id=programme.id,
        description=(
            f"Changed programme {programme.name} from "
            f"{old_status} to {target}"
        ),
        old_values={"status": old_status},
        new_values={"status": target},
    )

    await db.commit()

    result = await db.execute(
        select(Programme)
        .where(Programme.id == programme.id)
        .execution_options(populate_existing=True)
    )
    programme = result.scalar_one()
    return await _programme_detail(db, programme)


# ============================================================
# CURRICULUM
# ============================================================

@router.post(
    "/{programme_id}/courses",
    response_model=ProgrammeDetail,
    status_code=status.HTTP_201_CREATED,
)
async def add_course(
    programme_id: str,
    payload: CourseCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)

    code = _clean(payload.code)
    await _ensure_course_code_free(db, str(programme.id), code)

    sequence = payload.sequence
    if sequence is None:
        sequence = (
            await db.execute(
                select(func.coalesce(func.max(ProgrammeCourse.sequence), 0))
                .where(ProgrammeCourse.programme_id == programme.id)
            )
        ).scalar_one() + 1

    course = ProgrammeCourse(
        id=str(uuid.uuid4()),
        programme_id=programme.id,
        code=code,
        title=payload.title.strip(),
        description=payload.description,
        sequence=sequence,
        contact_hours=payload.contact_hours,
        learning_outcomes=payload.learning_outcomes,
        is_optional=payload.is_optional,
    )
    db.add(course)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_COURSE_ADDED",
        entity_type="programme",
        entity_id=programme.id,
        description=f"Added course {course.title} to {programme.name}",
        new_values={"course_id": course.id, "title": course.title},
    )

    await db.commit()
    return await _programme_detail(db, programme)


@router.patch(
    "/{programme_id}/courses/{course_id}",
    response_model=ProgrammeDetail,
)
async def update_course(
    programme_id: str,
    course_id: str,
    payload: CourseUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)

    course = await db.get(ProgrammeCourse, course_id)
    if not course or str(course.programme_id) != str(programme.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found in this programme",
        )

    changes = payload.model_dump(exclude_unset=True)
    if "code" in changes:
        changes["code"] = _clean(changes["code"])
        await _ensure_course_code_free(
            db,
            str(programme.id),
            changes["code"],
            exclude_id=str(course.id),
        )
    if "title" in changes and changes["title"]:
        changes["title"] = changes["title"].strip()

    for key, value in changes.items():
        setattr(course, key, value)

    if changes:
        await AuditService.log(
            db=db,
            actor=current_user,
            action="PROGRAMME_COURSE_UPDATED",
            entity_type="programme",
            entity_id=programme.id,
            description=f"Updated course {course.title}",
            new_values={"course_id": str(course.id)},
        )

    await db.commit()
    return await _programme_detail(db, programme)


@router.delete(
    "/{programme_id}/courses/{course_id}",
    response_model=ProgrammeDetail,
)
async def delete_course(
    programme_id: str,
    course_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)

    course = await db.get(ProgrammeCourse, course_id)
    if not course or str(course.programme_id) != str(programme.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found in this programme",
        )

    await db.delete(course)
    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_COURSE_REMOVED",
        entity_type="programme",
        entity_id=programme.id,
        description=f"Removed course {course.title}",
        old_values={"course_id": str(course.id)},
    )

    await db.commit()
    return await _programme_detail(db, programme)


@router.put(
    "/{programme_id}/courses/order",
    response_model=ProgrammeDetail,
)
async def reorder_courses(
    programme_id: str,
    payload: CourseOrderRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)

    courses = (
        await db.execute(
            select(ProgrammeCourse).where(
                ProgrammeCourse.programme_id == programme.id
            )
        )
    ).scalars().all()
    by_id = {str(course.id): course for course in courses}

    if set(payload.course_ids) != set(by_id.keys()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="course_ids must list every course in the programme",
        )

    for index, course_id in enumerate(payload.course_ids):
        by_id[course_id].sequence = index

    await db.commit()
    return await _programme_detail(db, programme)


@router.post(
    "/{programme_id}/cohorts",
    response_model=ProgrammeDetail,
    status_code=status.HTTP_201_CREATED,
)
async def create_cohort(
    programme_id: str,
    payload: CohortCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_permission(Permissions.PROGRAMMES_EDIT)
    ),
):
    programme = await _load_programme(db, programme_id)

    if programme.status in {"completed", "archived"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This programme is closed for new cohorts",
        )

    code = _clean(payload.code)
    await _ensure_cohort_code_free(db, str(programme.id), code)

    _validate_dates(payload.start_date, payload.end_date)
    _validate_dates(
        payload.enrolment_opens_on,
        payload.enrolment_closes_on,
        label="enrolment_closes_on",
        start_label="enrolment_opens_on",
    )

    cohort = ProgrammeCohort(
        id=str(uuid.uuid4()),
        programme_id=programme.id,
        name=payload.name.strip(),
        code=code,
        start_date=payload.start_date,
        end_date=payload.end_date,
        enrolment_opens_on=payload.enrolment_opens_on,
        enrolment_closes_on=payload.enrolment_closes_on,
        capacity=payload.capacity,
        delivery_mode=payload.delivery_mode,
        location=payload.location,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(cohort)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PROGRAMME_COHORT_CREATED",
        entity_type="programme",
        entity_id=programme.id,
        description=f"Created cohort {cohort.name}",
        new_values={"cohort_id": cohort.id, "name": cohort.name},
    )

    await db.commit()
    return await _programme_detail(db, programme)

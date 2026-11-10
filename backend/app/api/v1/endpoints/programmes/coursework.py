import math
from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_active_user, require_permission
from app.models.sql.core.organisation import Programme
from app.models.sql.core.user import User
from app.models.sql.programmes.academics import CohortEnrolment, ProgrammeCohort, ProgrammeCourse
from app.models.sql.programmes.coursework import AssignmentSubmission, CourseAssignment, utcnow, validate_rubric
from app.api.v1.endpoints.programmes.learner_workflow import PersonBrief
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService

router = APIRouter()
ROSTER_STATUSES = ("enrolled", "completed")


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class RubricCriterion(RequestModel):
    id: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    points: float = Field(ge=0)

    @field_validator("id", "label")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Must not be blank")
        return value

    @field_validator("points", mode="before")
    @classmethod
    def number(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Must be a number")
        return value


class AssignmentCreateRequest(RequestModel):
    course_id: UUID
    cohort_id: UUID
    title: str = Field(min_length=1, max_length=200)
    instructions: str | None = None
    due_on: date | None = None
    points_possible: float = Field(gt=0)
    rubric: list[RubricCriterion] = Field(default_factory=list)
    allow_resubmission: bool = True
    status: Literal["draft", "published"] = "draft"

    @field_validator("title")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Title must not be blank")
        return value

    @field_validator("points_possible", mode="before")
    @classmethod
    def number(cls, value):
        return RubricCriterion.number(value)


class AssignmentUpdateRequest(RequestModel):
    course_id: UUID | None = None
    cohort_id: UUID | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    instructions: str | None = None
    due_on: date | None = None
    points_possible: float | None = Field(None, gt=0)
    rubric: list[RubricCriterion] | None = None
    allow_resubmission: bool | None = None
    status: Literal["draft", "published", "closed"] | None = None

    @field_validator("title")
    @classmethod
    def nonblank(cls, value):
        return AssignmentCreateRequest.nonblank(value) if value is not None else value

    @field_validator("points_possible", mode="before")
    @classmethod
    def number(cls, value):
        return RubricCriterion.number(value) if value is not None else value


class SubmissionCreateRequest(RequestModel):
    enrolment_id: UUID
    content: str = Field(min_length=1, max_length=20000)

    @field_validator("content")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Content must not be blank")
        return value


class GradeRequest(RequestModel):
    score: float | None = Field(None, ge=0)
    feedback: str | None = Field(None, max_length=10000)
    rubric_scores: dict[str, float] = Field(default_factory=dict)
    request_resubmission: bool = False

    @field_validator("score", mode="before")
    @classmethod
    def number(cls, value):
        return RubricCriterion.number(value) if value is not None else value

    @field_validator("rubric_scores", mode="before")
    @classmethod
    def scores(cls, value):
        if not isinstance(value, dict):
            raise ValueError("rubric_scores must be an object")
        for score in value.values():
            RubricCriterion.number(score)
        return value


class AssignmentItem(BaseModel):
    id: str
    programme_id: str
    course_id: str
    course_title: str
    cohort_id: str
    cohort_name: str
    title: str
    instructions: str | None
    due_on: date | None
    points_possible: float
    rubric: list[RubricCriterion]
    allow_resubmission: bool
    status: Literal["draft", "published", "closed"]
    submitted_count: int
    graded_count: int
    missing_count: int


CourseAssignmentItem = AssignmentItem


class SubmissionItem(BaseModel):
    id: str
    enrolment_id: str
    attempt: int
    content: str
    submitted_at: datetime
    submitted_by: PersonBrief | None
    score: float | None
    feedback: str | None
    rubric_scores: dict[str, float]
    grading_status: Literal["submitted", "graded", "changes_requested"]
    graded_by: PersonBrief | None
    graded_at: datetime | None
    is_late: bool


class AssignmentLearnerItem(BaseModel):
    enrolment_id: str
    person: PersonBrief
    enrolment_status: str
    submission: SubmissionItem | None
    history: list[SubmissionItem]


class AssignmentDetail(BaseModel):
    assignment: AssignmentItem
    learners: list[AssignmentLearnerItem]


class GradebookCell(BaseModel):
    assignment_id: str
    submission_id: str | None
    score: float | None
    status: Literal["missing", "submitted", "graded", "changes_requested"]
    is_late: bool


class GradebookLearner(BaseModel):
    enrolment_id: str
    person: PersonBrief
    cohort_id: str
    cohort_name: str
    cells: list[GradebookCell]
    earned_points: float
    graded_points_possible: float
    percentage: float | None
    graded_count: int
    assignment_count: int


class GradebookResponse(BaseModel):
    assignments: list[AssignmentItem]
    learners: list[GradebookLearner]


class LearnerCourseworkItem(BaseModel):
    assignment: AssignmentItem
    enrolment_id: str
    programme_name: str
    submission: SubmissionItem | None
    history: list[SubmissionItem]


def _id(value):
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, "Invalid UUID")


def _person(person):
    if person is None:
        return None
    return PersonBrief(
        id=person.id, first_name=person.first_name, last_name=person.last_name,
        email=person.email, profile_image_url=person.profile_image_url,
    )


def _utc(value):
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _submission(submission, assignment):
    return SubmissionItem(
        id=submission.id, enrolment_id=submission.enrolment_id,
        attempt=submission.attempt, content=submission.content,
        submitted_at=_utc(submission.submitted_at), submitted_by=_person(submission.submitted_by),
        score=submission.score, feedback=submission.feedback,
        rubric_scores=submission.rubric_scores, grading_status=submission.grading_status,
        graded_by=_person(submission.graded_by), graded_at=_utc(submission.graded_at),
        is_late=bool(assignment.due_on and _utc(submission.submitted_at).date() > assignment.due_on),
    )


async def _permissions(db, user):
    if user is None or not isinstance(user, User):
        raise HTTPException(401, "Authentication required")
    await get_current_active_user(user)
    return {
        action: await PermissionService.has_permission(db, user.id, f"programmes.{action}")
        for action in ("view", "edit", "assess")
    }


def _staff(permissions):
    return permissions["view"] and (permissions["edit"] or permissions["assess"])


def _require(condition, message="Permission denied"):
    if not condition:
        raise HTTPException(403, message)


async def _programme(db, programme_id, permissions):
    programme = await db.get(Programme, _id(programme_id))
    if not programme or (programme.status == "draft" and not permissions["edit"]):
        raise HTTPException(404, "Programme not found")
    return programme


async def _assignment(db, assignment_id, permissions, lock=False):
    query = select(CourseAssignment).where(CourseAssignment.id == _id(assignment_id)).execution_options(populate_existing=True)
    if lock:
        query = query.with_for_update(of=CourseAssignment)
    assignment = (await db.execute(query)).scalar_one_or_none()
    if not assignment or (not permissions["edit"] and (assignment.status == "draft" or assignment.programme.status == "draft")):
        raise HTTPException(404, "Assignment not found")
    return assignment


async def _scope(db, programme_id, course_id, cohort_id):
    course = await db.get(ProgrammeCourse, _id(course_id))
    cohort = await db.get(ProgrammeCohort, _id(cohort_id))
    if not course or not cohort or course.programme_id != programme_id or cohort.programme_id != programme_id:
        raise HTTPException(400, "Course and cohort must belong to this programme")


async def _enrolment(db, enrolment_id):
    enrolment = (await db.execute(
        select(CohortEnrolment).options(selectinload(CohortEnrolment.person))
        .where(CohortEnrolment.id == _id(enrolment_id))
    )).scalar_one_or_none()
    if not enrolment:
        raise HTTPException(404, "Enrolment not found")
    return enrolment


async def _dataset(db, assignments, roster=None):
    cohort_ids = {a.cohort_id for a in assignments}
    if roster is None:
        roster = (await db.execute(
            select(CohortEnrolment).options(selectinload(CohortEnrolment.person))
            .where(CohortEnrolment.cohort_id.in_(cohort_ids), CohortEnrolment.status.in_(ROSTER_STATUSES))
            .order_by(CohortEnrolment.created_at, CohortEnrolment.id)
        )).scalars().all() if cohort_ids else []
    histories = {}
    if assignments:
        submissions = (await db.execute(
            select(AssignmentSubmission).where(AssignmentSubmission.assignment_id.in_([a.id for a in assignments]))
            .order_by(AssignmentSubmission.attempt, AssignmentSubmission.id)
        )).scalars().all()
        for submission in submissions:
            histories.setdefault((submission.assignment_id, submission.enrolment_id), []).append(submission)
    items = {}
    for assignment in assignments:
        learners = [e for e in roster if e.cohort_id == assignment.cohort_id]
        latest = [histories[(assignment.id, e.id)][-1] for e in learners if (assignment.id, e.id) in histories]
        items[assignment.id] = AssignmentItem(
            id=assignment.id, programme_id=assignment.programme_id,
            course_id=assignment.course_id, course_title=assignment.course.title,
            cohort_id=assignment.cohort_id, cohort_name=assignment.cohort.name,
            title=assignment.title, instructions=assignment.instructions,
            due_on=assignment.due_on, points_possible=assignment.points_possible,
            rubric=assignment.rubric, allow_resubmission=assignment.allow_resubmission,
            status=assignment.status, submitted_count=len(latest),
            graded_count=sum(s.grading_status == "graded" for s in latest),
            missing_count=len(learners) - len(latest),
        )
    return items, roster, histories


async def _commit(db):
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Conflicting coursework write; retry the request")


def _rubric(rubric, points):
    try:
        validate_rubric(rubric, points)
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@router.get("/{programme_id}/coursework", response_model=list[AssignmentItem])
async def list_coursework(programme_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    programme = await _programme(db, programme_id, permissions)
    query = select(CourseAssignment).where(CourseAssignment.programme_id == programme.id)
    if not _staff(permissions):
        query = query.where(
            CourseAssignment.status.in_(("published", "closed")),
            CourseAssignment.cohort_id.in_(select(CohortEnrolment.cohort_id).where(CohortEnrolment.person_id == current_user.person_id)),
        )
    elif not permissions["edit"]:
        query = query.where(CourseAssignment.status != "draft")
    assignments = (await db.execute(query.order_by(CourseAssignment.created_at, CourseAssignment.id))).scalars().all()
    items, _, _ = await _dataset(db, assignments)
    return [items[a.id] for a in assignments]


@router.post("/{programme_id}/coursework", response_model=AssignmentItem, status_code=201)
async def create_assignment(programme_id: UUID, payload: AssignmentCreateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("programmes.edit"))):
    permissions = await _permissions(db, current_user)
    _require(permissions["edit"])
    programme = await _programme(db, programme_id, permissions)
    await _scope(db, programme.id, payload.course_id, payload.cohort_id)
    rubric = [c.model_dump() for c in payload.rubric]
    _rubric(rubric, payload.points_possible)
    assignment = CourseAssignment(programme_id=programme.id, **payload.model_dump(exclude={"course_id", "cohort_id", "rubric"}), course_id=str(payload.course_id), cohort_id=str(payload.cohort_id), rubric=rubric)
    db.add(assignment)
    await db.flush()
    await AuditService.log(db, actor=current_user, action="coursework.assignment.create", entity_type="CourseAssignment", entity_id=assignment.id, new_values=payload.model_dump(mode="json"))
    await _commit(db)
    assignment = await _assignment(db, assignment.id, permissions)
    items, _, _ = await _dataset(db, [assignment])
    return items[assignment.id]


@router.patch("/coursework/{assignment_id}", response_model=AssignmentItem)
async def update_assignment(assignment_id: UUID, payload: AssignmentUpdateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("programmes.edit"))):
    permissions = await _permissions(db, current_user)
    _require(permissions["edit"])
    assignment = await _assignment(db, assignment_id, permissions, lock=True)
    updates = payload.model_dump(exclude_unset=True, mode="json")
    for field, value in updates.items():
        if value is None and field not in {"instructions", "due_on"}:
            raise HTTPException(400, f"{field} cannot be null")
    if assignment.status != "draft":
        if set(updates) & {"course_id", "cohort_id", "points_possible", "rubric"}:
            raise HTTPException(409, "Published assignment structure is immutable")
        if updates.get("status") == "draft":
            raise HTTPException(409, "Published assignments cannot return to draft")
    elif updates.get("status") == "closed":
        raise HTTPException(409, "Publish the assignment before closing it")
    await _scope(db, assignment.programme_id, updates.get("course_id", assignment.course_id), updates.get("cohort_id", assignment.cohort_id))
    _rubric(updates.get("rubric", assignment.rubric), updates.get("points_possible", assignment.points_possible))
    old = {field: getattr(assignment, field) for field in updates}
    old = {key: value.isoformat() if isinstance(value, date) else value for key, value in old.items()}
    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(assignment, field, str(value) if field in {"course_id", "cohort_id"} else value)
    await AuditService.log(db, actor=current_user, action="coursework.assignment.update", entity_type="CourseAssignment", entity_id=assignment.id, old_values=old, new_values=updates)
    await _commit(db)
    assignment = await _assignment(db, assignment.id, permissions)
    items, _, _ = await _dataset(db, [assignment])
    return items[assignment.id]


@router.get("/coursework/{assignment_id}", response_model=AssignmentDetail)
async def get_assignment(assignment_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    assignment = await _assignment(db, assignment_id, permissions)
    _require(_staff(permissions))
    items, roster, histories = await _dataset(db, [assignment])
    learners = []
    for enrolment in roster:
        history = [_submission(s, assignment) for s in histories.get((assignment.id, enrolment.id), [])]
        learners.append(AssignmentLearnerItem(enrolment_id=enrolment.id, person=_person(enrolment.person), enrolment_status=enrolment.status, submission=history[-1] if history else None, history=history))
    return AssignmentDetail(assignment=items[assignment.id], learners=learners)


@router.post("/coursework/{assignment_id}/submissions", response_model=SubmissionItem, status_code=201)
async def submit_assignment(assignment_id: UUID, payload: SubmissionCreateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    assignment = await _assignment(db, assignment_id, permissions, lock=True)
    enrolment = await _enrolment(db, payload.enrolment_id)
    _require(permissions["edit"] or enrolment.person_id == current_user.person_id, "Only the learner or a programme editor may submit")
    if enrolment.cohort_id != assignment.cohort_id:
        raise HTTPException(400, "Enrolment belongs to another cohort")
    if assignment.status != "published" or assignment.programme.status != "active" or assignment.cohort.status not in {"enrolling", "active"} or enrolment.status != "enrolled":
        raise HTTPException(409, "Assignment is not accepting submissions for this enrolment")
    latest = (await db.execute(
        select(AssignmentSubmission).where(AssignmentSubmission.assignment_id == assignment.id, AssignmentSubmission.enrolment_id == enrolment.id)
        .order_by(AssignmentSubmission.attempt.desc()).limit(1)
    )).scalar_one_or_none()
    if latest and (latest.grading_status == "submitted" or (not assignment.allow_resubmission and latest.grading_status != "changes_requested")):
        raise HTTPException(409, "A pending attempt exists or resubmission is disabled")
    submission = AssignmentSubmission(assignment_id=assignment.id, enrolment_id=enrolment.id, cohort_id=assignment.cohort_id, attempt=latest.attempt + 1 if latest else 1, content=payload.content, submitted_by_id=current_user.person_id)
    db.add(submission)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "A concurrent attempt exists; retry the request")
    await AuditService.log(db, actor=current_user, action="coursework.submission.create", entity_type="AssignmentSubmission", entity_id=submission.id, new_values={"assignment_id": assignment.id, "enrolment_id": enrolment.id, "attempt": submission.attempt})
    await _commit(db)
    submission = (await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.id == submission.id).execution_options(populate_existing=True))).scalar_one()
    return _submission(submission, assignment)


def _grade_values(assignment, payload):
    if payload.request_resubmission:
        if not payload.feedback or not payload.feedback.strip():
            raise HTTPException(400, "Nonblank feedback is required to request resubmission")
        return None, {}, "changes_requested"
    if assignment.rubric:
        criteria = {c["id"]: c["points"] for c in assignment.rubric}
        if set(payload.rubric_scores) != set(criteria):
            raise HTTPException(400, "rubric_scores must contain exactly the rubric criterion IDs")
        for key, value in payload.rubric_scores.items():
            if not math.isfinite(value) or not 0 <= value <= criteria[key]:
                raise HTTPException(400, "Rubric scores must be finite and within criterion bounds")
        score = sum(payload.rubric_scores.values())
        if payload.score is not None and not math.isclose(payload.score, score, rel_tol=1e-9, abs_tol=1e-8):
            raise HTTPException(400, "Score must equal the rubric score sum")
    else:
        if payload.rubric_scores:
            raise HTTPException(400, "This assignment has no rubric")
        score = payload.score
    if score is None or not math.isfinite(score) or not 0 <= score <= assignment.points_possible:
        raise HTTPException(400, "A finite score from zero to points_possible is required")
    return score, payload.rubric_scores, "graded"


def _grade_snapshot(submission):
    return {
        "score": submission.score, "feedback": submission.feedback,
        "rubric_scores": dict(submission.rubric_scores), "grading_status": submission.grading_status,
        "graded_by_id": submission.graded_by_id,
        "graded_at": _utc(submission.graded_at).isoformat() if submission.graded_at else None,
    }


@router.put("/coursework/submissions/{submission_id}/grade", response_model=SubmissionItem)
async def grade_submission(submission_id: UUID, payload: GradeRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("programmes.assess"))):
    permissions = await _permissions(db, current_user)
    _require(permissions["assess"])
    assignment_id = (await db.execute(select(AssignmentSubmission.assignment_id).where(AssignmentSubmission.id == _id(submission_id)))).scalar_one_or_none()
    if assignment_id is None:
        raise HTTPException(404, "Submission not found")
    assignment = await _assignment(db, assignment_id, permissions, lock=True)
    submission = (await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.id == _id(submission_id)).execution_options(populate_existing=True))).scalar_one()
    enrolment = await _enrolment(db, submission.enrolment_id)
    _require(enrolment.person_id != current_user.person_id, "Learners cannot grade their own submissions")
    latest_id = (await db.execute(select(AssignmentSubmission.id).where(AssignmentSubmission.assignment_id == assignment.id, AssignmentSubmission.enrolment_id == enrolment.id).order_by(AssignmentSubmission.attempt.desc()).limit(1))).scalar_one()
    if submission.id != latest_id:
        raise HTTPException(409, "Only the latest attempt may be graded")
    score, rubric_scores, grading_status = _grade_values(assignment, payload)
    old = _grade_snapshot(submission)
    submission.score = score
    submission.rubric_scores = rubric_scores
    submission.feedback = payload.feedback
    submission.grading_status = grading_status
    submission.graded_by_id = current_user.person_id
    submission.graded_at = utcnow()
    await AuditService.log(db, actor=current_user, action="coursework.submission.grade", entity_type="AssignmentSubmission", entity_id=submission.id, old_values=old, new_values=_grade_snapshot(submission))
    await _commit(db)
    submission = (await db.execute(select(AssignmentSubmission).where(AssignmentSubmission.id == submission.id).execution_options(populate_existing=True))).scalar_one()
    return _submission(submission, assignment)


@router.get("/{programme_id}/coursework/gradebook", response_model=GradebookResponse)
async def get_gradebook(programme_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    _require(_staff(permissions))
    programme = await _programme(db, programme_id, permissions)
    assignments = (await db.execute(select(CourseAssignment).where(CourseAssignment.programme_id == programme.id, CourseAssignment.status.in_(("published", "closed"))).order_by(CourseAssignment.created_at, CourseAssignment.id))).scalars().all()
    rows = (await db.execute(
        select(CohortEnrolment, ProgrammeCohort).join(ProgrammeCohort, CohortEnrolment.cohort_id == ProgrammeCohort.id)
        .options(selectinload(CohortEnrolment.person))
        .where(ProgrammeCohort.programme_id == programme.id, CohortEnrolment.status.in_(ROSTER_STATUSES))
        .order_by(ProgrammeCohort.name, CohortEnrolment.created_at, CohortEnrolment.id)
    )).all()
    items, _, histories = await _dataset(db, assignments, [e for e, _ in rows])
    learners = []
    for enrolment, cohort in rows:
        cells = []
        earned = possible = 0.0
        graded_count = 0
        for assignment in assignments:
            if assignment.cohort_id != enrolment.cohort_id:
                continue
            history = histories.get((assignment.id, enrolment.id), [])
            submission = history[-1] if history else None
            late = _submission(submission, assignment).is_late if submission else bool(assignment.due_on and utcnow().date() > assignment.due_on)
            cells.append(GradebookCell(assignment_id=assignment.id, submission_id=submission.id if submission else None, score=submission.score if submission else None, status=submission.grading_status if submission else "missing", is_late=late))
            if submission and submission.grading_status == "graded":
                earned += submission.score
                possible += assignment.points_possible
                graded_count += 1
        learners.append(GradebookLearner(enrolment_id=enrolment.id, person=_person(enrolment.person), cohort_id=cohort.id, cohort_name=cohort.name, cells=cells, earned_points=earned, graded_points_possible=possible, percentage=earned / possible * 100 if possible else None, graded_count=graded_count, assignment_count=len(cells)))
    return GradebookResponse(assignments=[items[a.id] for a in assignments], learners=learners)


async def _learner_listing(db, enrolments, permissions):
    if not enrolments:
        return []
    query = select(CourseAssignment).where(CourseAssignment.cohort_id.in_({e.cohort_id for e in enrolments}), CourseAssignment.status.in_(("published", "closed")))
    if not permissions["edit"]:
        query = query.join(Programme, CourseAssignment.programme_id == Programme.id).where(Programme.status != "draft")
    assignments = (await db.execute(query.order_by(CourseAssignment.created_at, CourseAssignment.id))).scalars().all()
    items, _, histories = await _dataset(db, assignments)
    result = []
    for enrolment in enrolments:
        for assignment in assignments:
            if assignment.cohort_id != enrolment.cohort_id:
                continue
            history = [_submission(s, assignment) for s in histories.get((assignment.id, enrolment.id), [])]
            result.append(LearnerCourseworkItem(assignment=items[assignment.id], enrolment_id=enrolment.id, programme_name=assignment.programme.name, submission=history[-1] if history else None, history=history))
    return result


@router.get("/enrolments/{enrolment_id}/coursework", response_model=list[LearnerCourseworkItem])
async def get_enrolment_coursework(enrolment_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    enrolment = await _enrolment(db, enrolment_id)
    _require(_staff(permissions) or enrolment.person_id == current_user.person_id)
    cohort = await db.get(ProgrammeCohort, enrolment.cohort_id)
    await _programme(db, cohort.programme_id, permissions)
    return await _learner_listing(db, [enrolment], permissions)


@router.get("/my/coursework", response_model=list[LearnerCourseworkItem])
async def get_my_coursework(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    permissions = await _permissions(db, current_user)
    enrolments = (await db.execute(select(CohortEnrolment).where(CohortEnrolment.person_id == current_user.person_id).order_by(CohortEnrolment.created_at, CohortEnrolment.id))).scalars().all()
    return await _learner_listing(db, enrolments, permissions)

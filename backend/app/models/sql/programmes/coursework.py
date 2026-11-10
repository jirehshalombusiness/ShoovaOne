import math
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, CheckConstraint, Column, Date, DateTime, Float, ForeignKey,
    ForeignKeyConstraint, Integer, JSON, String, Text, UniqueConstraint,
    event, func, inspect, select, text,
)
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import relationship
from sqlalchemy.sql.functions import FunctionElement

from app.models.sql.base import BaseModel, GUID


MAX_FLOAT = 1.7976931348623157e308


class json_kind(FunctionElement):
    type = String()
    inherit_cache = True


@compiles(json_kind, "sqlite")
def _sqlite_json_kind(element, compiler, **kw):
    return f"json_type({compiler.process(element.clauses, **kw)})"


@compiles(json_kind)
def _pg_json_kind(element, compiler, **kw):
    return f"json_typeof({compiler.process(element.clauses, **kw)})"


def utcnow():
    return datetime.now(timezone.utc)


def validate_rubric(rubric, points_possible):
    if not math.isfinite(points_possible) or points_possible <= 0:
        raise ValueError("points_possible must be positive and finite")
    if not isinstance(rubric, list):
        raise ValueError("rubric must be a list")
    ids = set()
    total = 0.0
    for criterion in rubric:
        if not isinstance(criterion, dict) or set(criterion) != {"id", "label", "points"}:
            raise ValueError("Each rubric criterion requires id, label and points")
        key, label, points = criterion["id"], criterion["label"], criterion["points"]
        if not isinstance(key, str) or not key.strip() or key in ids:
            raise ValueError("Rubric IDs must be nonblank and unique")
        if not isinstance(label, str) or not label.strip():
            raise ValueError("Rubric labels must be nonblank")
        if isinstance(points, bool) or not isinstance(points, (int, float)) or not math.isfinite(points) or points < 0:
            raise ValueError("Rubric points must be nonnegative and finite")
        ids.add(key)
        total += points
    if rubric and not math.isclose(total, points_possible, rel_tol=1e-9, abs_tol=1e-8):
        raise ValueError("Rubric points must sum to points_possible")


class CourseAssignment(BaseModel):
    __tablename__ = "course_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["course_id", "programme_id"],
            ["programme_courses.id", "programme_courses.programme_id"],
            name="fk_course_assignments_course_programme", ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["cohort_id", "programme_id"],
            ["programme_cohorts.id", "programme_cohorts.programme_id"],
            name="fk_course_assignments_cohort_programme", ondelete="CASCADE",
        ),
        UniqueConstraint("id", "cohort_id", name="uq_course_assignments_id_cohort"),
        CheckConstraint("length(trim(title)) > 0 AND length(title) <= 200", name="ck_course_assignments_title"),
        CheckConstraint(f"points_possible > 0 AND points_possible <= {MAX_FLOAT}", name="ck_course_assignments_points"),
        CheckConstraint("status IN ('draft', 'published', 'closed')", name="ck_course_assignments_status"),
        CheckConstraint(json_kind(Column("rubric", JSON)) == "array", name="ck_course_assignments_rubric"),
    )

    programme_id = Column(GUID, ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(GUID, nullable=False, index=True)
    cohort_id = Column(GUID, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    instructions = Column(Text)
    due_on = Column(Date)
    points_possible = Column(Float, nullable=False)
    rubric = Column(JSON, nullable=False, default=list, server_default=text("'[]'"))
    allow_resubmission = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    status = Column(String(20), nullable=False, default="draft", server_default=text("'draft'"), index=True)

    programme = relationship("Programme", foreign_keys=[programme_id], lazy="joined", viewonly=True)
    course = relationship("ProgrammeCourse", foreign_keys=[course_id, programme_id], lazy="joined", viewonly=True)
    cohort = relationship("ProgrammeCohort", foreign_keys=[cohort_id, programme_id], lazy="joined", viewonly=True)


class AssignmentSubmission(BaseModel):
    __tablename__ = "assignment_submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["assignment_id", "cohort_id"], ["course_assignments.id", "course_assignments.cohort_id"],
            name="fk_assignment_submissions_assignment_cohort", ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["enrolment_id", "cohort_id"], ["cohort_enrolments.id", "cohort_enrolments.cohort_id"],
            name="fk_assignment_submissions_enrolment_cohort", ondelete="CASCADE",
        ),
        UniqueConstraint("assignment_id", "enrolment_id", "attempt", name="uq_assignment_submissions_attempt"),
        CheckConstraint("attempt >= 1", name="ck_assignment_submissions_attempt"),
        CheckConstraint("length(trim(content)) > 0 AND length(content) <= 20000", name="ck_assignment_submissions_content"),
        CheckConstraint("feedback IS NULL OR length(feedback) <= 10000", name="ck_assignment_submissions_feedback"),
        CheckConstraint(f"score IS NULL OR (score >= 0 AND score <= {MAX_FLOAT})", name="ck_assignment_submissions_score"),
        CheckConstraint("grading_status IN ('submitted', 'graded', 'changes_requested')", name="ck_assignment_submissions_status"),
        CheckConstraint("(grading_status = 'graded' AND score IS NOT NULL AND graded_at IS NOT NULL) OR (grading_status != 'graded' AND score IS NULL)", name="ck_assignment_submissions_grade"),
        CheckConstraint("grading_status != 'changes_requested' OR (feedback IS NOT NULL AND length(trim(feedback)) > 0 AND graded_at IS NOT NULL)", name="ck_assignment_submissions_changes"),
        CheckConstraint(json_kind(Column("rubric_scores", JSON)) == "object", name="ck_assignment_submissions_rubric"),
    )

    assignment_id = Column(GUID, nullable=False, index=True)
    enrolment_id = Column(GUID, nullable=False, index=True)
    cohort_id = Column(GUID, nullable=False, index=True)
    attempt = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now())
    submitted_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), index=True)
    score = Column(Float)
    feedback = Column(Text)
    rubric_scores = Column(JSON, nullable=False, default=dict, server_default=text("'{}'"))
    grading_status = Column(String(20), nullable=False, default="submitted", server_default=text("'submitted'"), index=True)
    graded_by_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"), index=True)
    graded_at = Column(DateTime(timezone=True))

    submitted_by = relationship("Person", foreign_keys=[submitted_by_id], lazy="joined")
    graded_by = relationship("Person", foreign_keys=[graded_by_id], lazy="joined")


@event.listens_for(CourseAssignment, "before_insert")
@event.listens_for(CourseAssignment, "before_update")
def _validate_assignment(mapper, connection, assignment):
    validate_rubric(assignment.rubric or [], assignment.points_possible)
    state = inspect(assignment)
    if state.persistent:
        previous = connection.execute(select(CourseAssignment.__table__).where(CourseAssignment.id == assignment.id)).mappings().one()
        if previous["status"] != "draft":
            for field in ("programme_id", "course_id", "cohort_id", "points_possible", "rubric"):
                if getattr(assignment, field) != previous[field]:
                    raise ValueError("Published assignment structure is immutable")
            if assignment.status == "draft":
                raise ValueError("Published assignments cannot return to draft")


@event.listens_for(AssignmentSubmission, "before_update")
def _immutable_attempt(mapper, connection, submission):
    state = inspect(submission)
    for field in ("assignment_id", "enrolment_id", "cohort_id", "attempt", "content", "submitted_at"):
        if state.attrs[field].history.has_changes():
            raise ValueError("Submission attempt content and identity are immutable")
    history = state.attrs.submitted_by_id.history
    if history.has_changes() and submission.submitted_by_id is not None:
        raise ValueError("Submission author is immutable")

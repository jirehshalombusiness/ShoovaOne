from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import (
    Permissions,
    require_all_permissions,
    require_permission,
)
from app.models.sql.core.document import Document
from app.models.sql.core.user import Person, User
from app.models.sql.programmes.academics import (
    CohortEnrolment,
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
from app.services.core.audit_service import AuditService
from app.services.core.permission_service import PermissionService

router = APIRouter()

ASSIGNMENT_STATUSES = {"assigned", "in_progress", "submitted", "completed", "follow_up"}
TASK_STATUSES = {"assigned", "in_progress", "submitted", "completed"}
EVIDENCE_TYPES = {"photo", "document", "note", "observation", "gps", "artifact"}
COMPETENCY_RESULTS = {"met", "partially_met", "not_met"}
EVIDENCE_QUALITIES = {"strong", "adequate", "weak"}
VULNERABILITY_CLASSES = {"low", "moderate", "high"}
AFFORD_TRAINING_OPTIONS = {"yes", "no", "with_assistance"}
OVERDUE_ASSESSMENT_DAYS = 7


# ============================================================
# SCHEMAS
# ============================================================

class PersonBrief(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    profile_image_url: Optional[str] = None


class CourseBrief(BaseModel):
    id: str
    code: Optional[str] = None
    title: str
    learning_outcomes: Optional[str] = None


class BaselineItem(BaseModel):
    household_income_band: Optional[str] = None
    employment_status: Optional[str] = None
    can_afford_training: Optional[str] = None
    device_access: Optional[str] = None
    internet_access: Optional[str] = None
    transport_constraints: Optional[str] = None
    education_status: Optional[str] = None
    household_dependents: Optional[int] = None
    vulnerability_class: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: Optional[PersonBrief] = None
    recorded_on: Optional[date] = None


class AssessmentItem(BaseModel):
    id: str
    mentor: PersonBrief
    assessed_on: Optional[date] = None
    competency_result: str
    feedback: Optional[str] = None
    follow_up: Optional[str] = None
    evidence_quality: Optional[str] = None
    created_at: Optional[str] = None


class EvidenceItem(BaseModel):
    id: str
    evidence_type: str
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    file_url: Optional[str] = None
    field_notes: Optional[str] = None
    reflection: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    location_label: Optional[str] = None
    recorded_on: Optional[date] = None
    submitted_by: Optional[PersonBrief] = None
    assessments: List[AssessmentItem] = []


class TaskItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    instructions: Optional[str] = None
    safety_requirements: Optional[str] = None
    expected_evidence: Optional[str] = None
    due_on: Optional[date] = None
    status: str
    completed_on: Optional[date] = None
    evidence: List[EvidenceItem] = []


class AssignmentItem(BaseModel):
    id: str
    course: CourseBrief
    competency: str
    assigned_on: Optional[date] = None
    due_on: Optional[date] = None
    status: str
    next_action: Optional[str] = None
    completed_on: Optional[date] = None
    tasks: List[TaskItem] = []


class OutcomeItem(BaseModel):
    demonstrated_skills: Optional[str] = None
    field_outputs: Optional[str] = None
    further_training: Optional[str] = None
    placement_status: Optional[str] = None
    follow_up_status: Optional[str] = None
    follow_up_on: Optional[date] = None
    notes: Optional[str] = None


class ProgressSummary(BaseModel):
    assignments_total: int
    competencies_completed: int
    competencies_pending: int
    next_module: Optional[str] = None
    next_action: Optional[str] = None
    readiness: str


class JourneyResponse(BaseModel):
    enrolment_id: str
    person: PersonBrief
    cohort_id: str
    cohort_name: str
    programme_id: str
    programme_name: str
    status: str
    enrolled_on: Optional[date] = None
    completed_on: Optional[date] = None
    can_view_baseline: bool
    baseline: Optional[BaselineItem] = None
    assignments: List[AssignmentItem] = []
    progress: ProgressSummary
    outcome: Optional[OutcomeItem] = None


class BaselineRequest(BaseModel):
    household_income_band: Optional[str] = Field(None, max_length=50)
    employment_status: Optional[str] = Field(None, max_length=50)
    can_afford_training: Optional[str] = Field(None, max_length=20)
    device_access: Optional[str] = Field(None, max_length=50)
    internet_access: Optional[str] = Field(None, max_length=50)
    transport_constraints: Optional[str] = None
    education_status: Optional[str] = Field(None, max_length=50)
    household_dependents: Optional[int] = Field(None, ge=0, le=50)
    vulnerability_class: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    recorded_on: Optional[date] = None

    @field_validator("can_afford_training")
    @classmethod
    def valid_afford(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in AFFORD_TRAINING_OPTIONS:
            raise ValueError(f"must be one of {sorted(AFFORD_TRAINING_OPTIONS)}")
        return value

    @field_validator("vulnerability_class")
    @classmethod
    def valid_vulnerability(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VULNERABILITY_CLASSES:
            raise ValueError(f"must be one of {sorted(VULNERABILITY_CLASSES)}")
        return value


class AssignmentCreateRequest(BaseModel):
    course_id: str
    competency: str = Field(..., min_length=2, max_length=300)
    assigned_on: Optional[date] = None
    due_on: Optional[date] = None


class AssignmentUpdateRequest(BaseModel):
    competency: Optional[str] = Field(None, min_length=2, max_length=300)
    assigned_on: Optional[date] = None
    due_on: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)
    next_action: Optional[str] = Field(None, max_length=300)
    completed_on: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ASSIGNMENT_STATUSES:
            raise ValueError(f"must be one of {sorted(ASSIGNMENT_STATUSES)}")
        return value


class TaskCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    instructions: Optional[str] = None
    safety_requirements: Optional[str] = None
    expected_evidence: Optional[str] = None
    due_on: Optional[date] = None


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = None
    location: Optional[str] = Field(None, max_length=255)
    instructions: Optional[str] = None
    safety_requirements: Optional[str] = None
    expected_evidence: Optional[str] = None
    due_on: Optional[date] = None
    status: Optional[str] = Field(None, max_length=20)
    completed_on: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in TASK_STATUSES:
            raise ValueError(f"must be one of {sorted(TASK_STATUSES)}")
        return value


class EvidenceCreateRequest(BaseModel):
    evidence_type: str = Field("note", max_length=30)
    document_id: Optional[str] = None
    file_url: Optional[str] = None
    field_notes: Optional[str] = None
    reflection: Optional[str] = None
    gps_lat: Optional[float] = Field(None, ge=-90, le=90)
    gps_lng: Optional[float] = Field(None, ge=-180, le=180)
    location_label: Optional[str] = Field(None, max_length=255)
    recorded_on: Optional[date] = None

    @field_validator("evidence_type")
    @classmethod
    def valid_type(cls, value: str) -> str:
        if value not in EVIDENCE_TYPES:
            raise ValueError(f"must be one of {sorted(EVIDENCE_TYPES)}")
        return value


class AssessmentCreateRequest(BaseModel):
    competency_result: str = Field(..., max_length=20)
    feedback: Optional[str] = None
    follow_up: Optional[str] = None
    evidence_quality: Optional[str] = Field(None, max_length=20)
    assessed_on: Optional[date] = None

    @field_validator("competency_result")
    @classmethod
    def valid_result(cls, value: str) -> str:
        if value not in COMPETENCY_RESULTS:
            raise ValueError(f"must be one of {sorted(COMPETENCY_RESULTS)}")
        return value

    @field_validator("evidence_quality")
    @classmethod
    def valid_quality(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in EVIDENCE_QUALITIES:
            raise ValueError(f"must be one of {sorted(EVIDENCE_QUALITIES)}")
        return value


class OutcomeRequest(BaseModel):
    demonstrated_skills: Optional[str] = None
    field_outputs: Optional[str] = None
    further_training: Optional[str] = None
    placement_status: Optional[str] = Field(None, max_length=50)
    follow_up_status: Optional[str] = Field(None, max_length=50)
    follow_up_on: Optional[date] = None
    notes: Optional[str] = None


class FollowUpItem(BaseModel):
    enrolment_id: str
    person: PersonBrief
    next_action: Optional[str] = None


class OverdueEvidenceItem(BaseModel):
    evidence_id: str
    person: PersonBrief
    task_title: str
    submitted_on: Optional[date] = None
    days_waiting: int


class VulnerabilitySummary(BaseModel):
    recorded: int
    low: int
    moderate: int
    high: int
    high_percent: Optional[float] = None


class CohortDashboard(BaseModel):
    cohort_id: str
    cohort_name: str
    programme_name: str
    active_learners: int
    completed_learners: int
    assignments_total: int
    assignments_completed: int
    module_completion_rate: float
    competencies_demonstrated: int
    competencies_pending: int
    tasks_total: int
    tasks_completed: int
    evidence_submissions: int
    assessments_completed: int
    assessments_overdue: int
    learners_needing_follow_up: List[FollowUpItem] = []
    overdue_evidence: List[OverdueEvidenceItem] = []
    vulnerability: Optional[VulnerabilitySummary] = None
    outcomes_recorded: int


# ============================================================
# HELPERS
# ============================================================

def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


def _clean(value: Optional[str]) -> Optional[str]:
    value = (value or "").strip()
    return value or None


def _person_brief(person: Optional[Person]) -> Optional[PersonBrief]:
    if not person:
        return None
    return PersonBrief(
        id=str(person.id),
        first_name=person.first_name,
        last_name=person.last_name,
        email=person.email,
        profile_image_url=person.profile_image_url,
    )


def _required_person_brief(person: Optional[Person]) -> PersonBrief:
    brief = _person_brief(person)
    if brief:
        return brief
    return PersonBrief(id="", first_name="Unknown", last_name="")


async def _can_manage(db: AsyncSession, user: User) -> bool:
    return await PermissionService.has_permission(
        db, user.id, Permissions.PROGRAMMES_EDIT
    )


async def _can_view_baseline(db: AsyncSession, user: User) -> bool:
    return await PermissionService.has_permission(
        db, user.id, Permissions.PROGRAMMES_VIEW_BASELINE
    )


async def _load_enrolment(db: AsyncSession, enrolment_id: str) -> CohortEnrolment:
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


async def _load_cohort(db: AsyncSession, cohort_id: str) -> ProgrammeCohort:
    result = await db.execute(
        select(ProgrammeCohort).where(ProgrammeCohort.id == cohort_id)
    )
    cohort = result.scalar_one_or_none()
    if not cohort:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort not found",
        )
    return cohort


async def _require_visible(db: AsyncSession, cohort: ProgrammeCohort, user: User) -> None:
    programme = cohort.programme
    if programme and programme.status == "draft" and not await _can_manage(db, user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cohort not found",
        )


async def _load_assignment(db: AsyncSession, assignment_id: str) -> ModuleAssignment:
    result = await db.execute(
        select(ModuleAssignment).where(ModuleAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module assignment not found",
        )
    return assignment


async def _load_task(db: AsyncSession, task_id: str) -> PracticalTask:
    result = await db.execute(
        select(PracticalTask).where(PracticalTask.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Practical task not found",
        )
    return task


async def _load_evidence(db: AsyncSession, evidence_id: str) -> EvidenceRecord:
    result = await db.execute(
        select(EvidenceRecord).where(EvidenceRecord.id == evidence_id)
    )
    evidence = result.scalar_one_or_none()
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found",
        )
    return evidence


def _validate_dates(assigned_on: Optional[date], due_on: Optional[date]) -> None:
    if assigned_on and due_on and due_on < assigned_on:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="due_on cannot be before assigned_on",
        )


def _baseline_item(baseline: LearnerBaseline) -> BaselineItem:
    return BaselineItem(
        household_income_band=baseline.household_income_band,
        employment_status=baseline.employment_status,
        can_afford_training=baseline.can_afford_training,
        device_access=baseline.device_access,
        internet_access=baseline.internet_access,
        transport_constraints=baseline.transport_constraints,
        education_status=baseline.education_status,
        household_dependents=baseline.household_dependents,
        vulnerability_class=baseline.vulnerability_class,
        notes=baseline.notes,
        recorded_by=_person_brief(baseline.recorder),
        recorded_on=baseline.recorded_on,
    )


def _outcome_item(outcome: LearnerOutcome) -> OutcomeItem:
    return OutcomeItem(
        demonstrated_skills=outcome.demonstrated_skills,
        field_outputs=outcome.field_outputs,
        further_training=outcome.further_training,
        placement_status=outcome.placement_status,
        follow_up_status=outcome.follow_up_status,
        follow_up_on=outcome.follow_up_on,
        notes=outcome.notes,
    )


def _assessment_item(assessment: MentorAssessment) -> AssessmentItem:
    return AssessmentItem(
        id=str(assessment.id),
        mentor=_required_person_brief(assessment.mentor),
        assessed_on=assessment.assessed_on,
        competency_result=assessment.competency_result,
        feedback=assessment.feedback,
        follow_up=assessment.follow_up,
        evidence_quality=assessment.evidence_quality,
        created_at=_iso(assessment.created_at),
    )


def _evidence_item(
    evidence: EvidenceRecord,
    assessments: List[MentorAssessment],
) -> EvidenceItem:
    return EvidenceItem(
        id=str(evidence.id),
        evidence_type=evidence.evidence_type,
        document_id=str(evidence.document_id) if evidence.document_id else None,
        document_name=evidence.document.name if evidence.document else None,
        file_url=evidence.file_url,
        field_notes=evidence.field_notes,
        reflection=evidence.reflection,
        gps_lat=evidence.gps_lat,
        gps_lng=evidence.gps_lng,
        location_label=evidence.location_label,
        recorded_on=evidence.recorded_on,
        submitted_by=_person_brief(evidence.submitter),
        assessments=[_assessment_item(a) for a in assessments],
    )


def _task_item(task: PracticalTask, evidence: List[EvidenceItem]) -> TaskItem:
    return TaskItem(
        id=str(task.id),
        title=task.title,
        description=task.description,
        location=task.location,
        instructions=task.instructions,
        safety_requirements=task.safety_requirements,
        expected_evidence=task.expected_evidence,
        due_on=task.due_on,
        status=task.status,
        completed_on=task.completed_on,
        evidence=evidence,
    )


def _assignment_item(assignment: ModuleAssignment, tasks: List[TaskItem]) -> AssignmentItem:
    course = assignment.course
    return AssignmentItem(
        id=str(assignment.id),
        course=CourseBrief(
            id=str(course.id),
            code=course.code,
            title=course.title,
            learning_outcomes=course.learning_outcomes,
        ),
        competency=assignment.competency,
        assigned_on=assignment.assigned_on,
        due_on=assignment.due_on,
        status=assignment.status,
        next_action=assignment.next_action,
        completed_on=assignment.completed_on,
        tasks=tasks,
    )


_DEFAULT_NEXT_ACTIONS = {
    "assigned": "Start the learning module",
    "in_progress": "Complete the practical task and submit evidence",
    "submitted": "Await mentor assessment",
    "follow_up": "Address the mentor's follow-up actions",
}


def _progress_summary(
    assignments: List[ModuleAssignment],
    enrolment_status: str,
) -> ProgressSummary:
    total = len(assignments)
    completed = sum(1 for a in assignments if a.status == "completed")
    pending = [a for a in assignments if a.status != "completed"]
    pending.sort(key=lambda a: (a.due_on is None, a.due_on or date.max, a.created_at))

    next_module = None
    next_action = None
    if pending:
        nxt = pending[0]
        next_module = nxt.course.title if nxt.course else None
        next_action = nxt.next_action or _DEFAULT_NEXT_ACTIONS.get(nxt.status)

    if enrolment_status == "completed":
        readiness = "completed"
    elif total == 0:
        readiness = "not_started"
    elif not pending:
        readiness = "ready_for_completion"
    else:
        readiness = "in_progress"

    return ProgressSummary(
        assignments_total=total,
        competencies_completed=completed,
        competencies_pending=len(pending),
        next_module=next_module,
        next_action=next_action,
        readiness=readiness,
    )


async def _journey_assignments(
    db: AsyncSession,
    enrolment_id: str,
) -> tuple:
    """Load the full assignment -> task -> evidence -> assessment tree in bulk."""
    assignments = (
        await db.execute(
            select(ModuleAssignment)
            .where(ModuleAssignment.enrolment_id == enrolment_id)
            .order_by(ModuleAssignment.created_at)
        )
    ).scalars().all()

    assignment_ids = [a.id for a in assignments]
    tasks = []
    if assignment_ids:
        tasks = (
            await db.execute(
                select(PracticalTask)
                .where(PracticalTask.assignment_id.in_(assignment_ids))
                .order_by(PracticalTask.created_at)
            )
        ).scalars().all()

    task_ids = [t.id for t in tasks]
    evidence = []
    if task_ids:
        evidence = (
            await db.execute(
                select(EvidenceRecord)
                .where(EvidenceRecord.task_id.in_(task_ids))
                .order_by(EvidenceRecord.created_at)
            )
        ).scalars().all()

    evidence_ids = [e.id for e in evidence]
    assessments = []
    if evidence_ids:
        assessments = (
            await db.execute(
                select(MentorAssessment)
                .where(MentorAssessment.evidence_id.in_(evidence_ids))
                .order_by(MentorAssessment.created_at)
            )
        ).scalars().all()

    assessments_by_evidence: dict = {}
    for assessment in assessments:
        assessments_by_evidence.setdefault(str(assessment.evidence_id), []).append(assessment)

    evidence_by_task: dict = {}
    for record in evidence:
        evidence_by_task.setdefault(str(record.task_id), []).append(
            _evidence_item(record, assessments_by_evidence.get(str(record.id), []))
        )

    tasks_by_assignment: dict = {}
    for task in tasks:
        tasks_by_assignment.setdefault(str(task.assignment_id), []).append(
            _task_item(task, evidence_by_task.get(str(task.id), []))
        )

    items = [
        _assignment_item(a, tasks_by_assignment.get(str(a.id), []))
        for a in assignments
    ]
    return assignments, items


# ============================================================
# JOURNEY
# ============================================================

@router.get("/enrolments/{enrolment_id}/journey", response_model=JourneyResponse)
async def get_journey(
    enrolment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_VIEW)),
):
    """One learner's full workflow. Baseline is omitted without programmes.view_baseline."""
    enrolment = await _load_enrolment(db, enrolment_id)
    cohort = await _load_cohort(db, str(enrolment.cohort_id))
    await _require_visible(db, cohort, current_user)

    can_view_baseline = await _can_view_baseline(db, current_user)
    baseline = None
    if can_view_baseline:
        baseline = (
            await db.execute(
                select(LearnerBaseline).where(
                    LearnerBaseline.enrolment_id == enrolment.id
                )
            )
        ).scalar_one_or_none()

    assignments, assignment_items = await _journey_assignments(db, str(enrolment.id))

    outcome = (
        await db.execute(
            select(LearnerOutcome).where(LearnerOutcome.enrolment_id == enrolment.id)
        )
    ).scalar_one_or_none()

    programme = cohort.programme
    return JourneyResponse(
        enrolment_id=str(enrolment.id),
        person=_required_person_brief(enrolment.person),
        cohort_id=str(cohort.id),
        cohort_name=cohort.name,
        programme_id=str(cohort.programme_id),
        programme_name=programme.name if programme else "",
        status=enrolment.status,
        enrolled_on=enrolment.enrolled_on,
        completed_on=enrolment.completed_on,
        can_view_baseline=can_view_baseline,
        baseline=_baseline_item(baseline) if baseline else None,
        assignments=assignment_items,
        progress=_progress_summary(assignments, enrolment.status),
        outcome=_outcome_item(outcome) if outcome else None,
    )


# ============================================================
# BASELINE (restricted)
# ============================================================

@router.put("/enrolments/{enrolment_id}/baseline", response_model=BaselineItem)
async def record_baseline(
    enrolment_id: str,
    payload: BaselineRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_all_permissions([
            Permissions.PROGRAMMES_VIEW_BASELINE,
            Permissions.PROGRAMMES_EDIT,
        ])
    ),
):
    enrolment = await _load_enrolment(db, enrolment_id)
    baseline = (
        await db.execute(
            select(LearnerBaseline).where(
                LearnerBaseline.enrolment_id == enrolment.id
            )
        )
    ).scalar_one_or_none()

    created = baseline is None
    if created:
        baseline = LearnerBaseline(enrolment_id=enrolment.id)
        db.add(baseline)

    for field in (
        "household_income_band",
        "employment_status",
        "can_afford_training",
        "device_access",
        "internet_access",
        "transport_constraints",
        "education_status",
        "household_dependents",
        "vulnerability_class",
        "notes",
    ):
        setattr(baseline, field, getattr(payload, field))
    baseline.recorded_by = current_user.person_id
    baseline.recorded_on = payload.recorded_on or date.today()

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEARNER_BASELINE_RECORDED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description="Recorded the learner socioeconomic baseline",
        new_values={
            "vulnerability_class": baseline.vulnerability_class,
            "recorded_on": baseline.recorded_on.isoformat(),
        },
    )
    await db.commit()
    await db.refresh(baseline)
    return _baseline_item(baseline)


# ============================================================
# MODULE ASSIGNMENTS
# ============================================================

@router.post(
    "/enrolments/{enrolment_id}/assignments",
    response_model=AssignmentItem,
    status_code=status.HTTP_201_CREATED,
)
async def assign_module(
    enrolment_id: str,
    payload: AssignmentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    enrolment = await _load_enrolment(db, enrolment_id)
    cohort = await _load_cohort(db, str(enrolment.cohort_id))

    course = await db.get(ProgrammeCourse, payload.course_id)
    if not course or str(course.programme_id) != str(cohort.programme_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course does not belong to this programme",
        )

    existing = (
        await db.execute(
            select(ModuleAssignment).where(
                ModuleAssignment.enrolment_id == enrolment.id,
                ModuleAssignment.course_id == course.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This module is already assigned to the learner",
        )

    _validate_dates(payload.assigned_on, payload.due_on)
    assignment = ModuleAssignment(
        enrolment_id=enrolment.id,
        course_id=course.id,
        competency=payload.competency.strip(),
        assigned_on=payload.assigned_on or date.today(),
        due_on=payload.due_on,
    )
    db.add(assignment)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="MODULE_ASSIGNED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description=f"Assigned module {course.title}",
        new_values={
            "course_id": str(course.id),
            "competency": assignment.competency,
            "due_on": _iso(assignment.due_on),
        },
    )
    await db.commit()
    await db.refresh(assignment)
    return _assignment_item(assignment, [])


@router.patch("/assignments/{assignment_id}", response_model=AssignmentItem)
async def update_assignment(
    assignment_id: str,
    payload: AssignmentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    assignment = await _load_assignment(db, assignment_id)

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes provided",
        )

    for field, value in changes.items():
        setattr(assignment, field, value)

    _validate_dates(assignment.assigned_on, assignment.due_on)
    if assignment.status == "completed" and not assignment.completed_on:
        assignment.completed_on = date.today()
    elif assignment.status != "completed":
        assignment.completed_on = None

    await AuditService.log(
        db=db,
        actor=current_user,
        action="MODULE_ASSIGNMENT_UPDATED",
        entity_type="module_assignment",
        entity_id=assignment.id,
        description=f"Updated module assignment ({assignment.status})",
        new_values={key: _iso(value) if isinstance(value, date) else value for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(assignment)
    _, items = await _journey_assignments(db, str(assignment.enrolment_id))
    return next(item for item in items if item.id == str(assignment.id))


# ============================================================
# PRACTICAL TASKS
# ============================================================

@router.post(
    "/assignments/{assignment_id}/tasks",
    response_model=TaskItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    assignment_id: str,
    payload: TaskCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    assignment = await _load_assignment(db, assignment_id)
    task = PracticalTask(
        assignment_id=assignment.id,
        title=payload.title.strip(),
        description=payload.description,
        location=_clean(payload.location),
        instructions=payload.instructions,
        safety_requirements=payload.safety_requirements,
        expected_evidence=payload.expected_evidence,
        due_on=payload.due_on,
    )
    db.add(task)

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PRACTICAL_TASK_CREATED",
        entity_type="module_assignment",
        entity_id=assignment.id,
        description=f"Added practical task {task.title}",
        new_values={"title": task.title, "due_on": _iso(task.due_on)},
    )
    await db.commit()
    await db.refresh(task)
    return _task_item(task, [])


@router.patch("/tasks/{task_id}", response_model=TaskItem)
async def update_task(
    task_id: str,
    payload: TaskUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    task = await _load_task(db, task_id)
    assignment = await _load_assignment(db, str(task.assignment_id))

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes provided",
        )

    for field, value in changes.items():
        setattr(task, field, value)

    if task.status == "completed" and not task.completed_on:
        task.completed_on = date.today()
    elif task.status != "completed":
        task.completed_on = None

    await AuditService.log(
        db=db,
        actor=current_user,
        action="PRACTICAL_TASK_UPDATED",
        entity_type="practical_task",
        entity_id=task.id,
        description=f"Updated practical task ({task.status})",
        new_values={key: _iso(value) if isinstance(value, date) else value for key, value in changes.items()},
    )
    await db.commit()
    await db.refresh(task)
    _, items = await _journey_assignments(db, str(assignment.enrolment_id))
    for item in items:
        for task_item in item.tasks:
            if task_item.id == str(task.id):
                return task_item
    raise HTTPException(status_code=404, detail="Practical task not found")


# ============================================================
# EVIDENCE
# ============================================================

@router.post(
    "/tasks/{task_id}/evidence",
    response_model=EvidenceItem,
    status_code=status.HTTP_201_CREATED,
)
async def submit_evidence(
    task_id: str,
    payload: EvidenceCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    task = await _load_task(db, task_id)
    assignment = await _load_assignment(db, str(task.assignment_id))

    if (payload.gps_lat is None) != (payload.gps_lng is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="gps_lat and gps_lng must be provided together",
        )

    file_url = _clean(payload.file_url)
    if file_url and not file_url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_url must be an http(s) link",
        )

    document_id = _clean(payload.document_id)
    if document_id:
        document = await db.get(Document, document_id)
        if not document or document.deleted_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown document",
            )

    evidence = EvidenceRecord(
        task_id=task.id,
        evidence_type=payload.evidence_type,
        document_id=document_id,
        file_url=file_url,
        field_notes=payload.field_notes,
        reflection=payload.reflection,
        gps_lat=payload.gps_lat,
        gps_lng=payload.gps_lng,
        location_label=_clean(payload.location_label),
        recorded_on=payload.recorded_on or date.today(),
        submitted_by=current_user.person_id,
    )
    db.add(evidence)

    if task.status in {"assigned", "in_progress"}:
        task.status = "submitted"
    if assignment.status in {"assigned", "in_progress"}:
        assignment.status = "submitted"

    await AuditService.log(
        db=db,
        actor=current_user,
        action="EVIDENCE_SUBMITTED",
        entity_type="practical_task",
        entity_id=task.id,
        description=f"Evidence submitted for {task.title}",
        new_values={
            "evidence_type": evidence.evidence_type,
            "recorded_on": evidence.recorded_on.isoformat(),
            "has_gps": evidence.gps_lat is not None,
        },
    )
    await db.commit()
    await db.refresh(evidence)
    return _evidence_item(evidence, [])


# ============================================================
# MENTOR ASSESSMENTS
# ============================================================

@router.post(
    "/evidence/{evidence_id}/assessments",
    response_model=AssessmentItem,
    status_code=status.HTTP_201_CREATED,
)
async def assess_evidence(
    evidence_id: str,
    payload: AssessmentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_ASSESS)),
):
    """The latest result drives progress: met completes the task and assignment."""
    evidence = await _load_evidence(db, evidence_id)
    task = await _load_task(db, str(evidence.task_id))
    assignment = await _load_assignment(db, str(task.assignment_id))

    assessment = MentorAssessment(
        evidence_id=evidence.id,
        mentor_id=current_user.person_id,
        assessed_on=payload.assessed_on or date.today(),
        competency_result=payload.competency_result,
        feedback=payload.feedback,
        follow_up=payload.follow_up,
        evidence_quality=payload.evidence_quality,
    )
    db.add(assessment)

    if payload.competency_result == "met":
        task.status = "completed"
        task.completed_on = assessment.assessed_on
        assignment.status = "completed"
        assignment.completed_on = assessment.assessed_on
        assignment.next_action = None
    else:
        assignment.status = "follow_up"
        assignment.completed_on = None
        assignment.next_action = _clean(payload.follow_up) or "Address the mentor's follow-up actions"

    await AuditService.log(
        db=db,
        actor=current_user,
        action="EVIDENCE_ASSESSED",
        entity_type="evidence_record",
        entity_id=evidence.id,
        description=f"Evidence assessed: {payload.competency_result}",
        new_values={
            "competency_result": payload.competency_result,
            "evidence_quality": payload.evidence_quality,
            "assignment_status": assignment.status,
        },
    )
    await db.commit()
    await db.refresh(assessment)
    return _assessment_item(assessment)


# ============================================================
# OUTCOMES
# ============================================================

@router.put("/enrolments/{enrolment_id}/outcome", response_model=OutcomeItem)
async def record_outcome(
    enrolment_id: str,
    payload: OutcomeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_EDIT)),
):
    enrolment = await _load_enrolment(db, enrolment_id)
    outcome = (
        await db.execute(
            select(LearnerOutcome).where(LearnerOutcome.enrolment_id == enrolment.id)
        )
    ).scalar_one_or_none()
    if not outcome:
        outcome = LearnerOutcome(enrolment_id=enrolment.id)
        db.add(outcome)

    for field in (
        "demonstrated_skills",
        "field_outputs",
        "further_training",
        "placement_status",
        "follow_up_status",
        "follow_up_on",
        "notes",
    ):
        setattr(outcome, field, getattr(payload, field))

    await AuditService.log(
        db=db,
        actor=current_user,
        action="LEARNER_OUTCOME_RECORDED",
        entity_type="cohort_enrolment",
        entity_id=enrolment.id,
        description="Recorded the learner outcome",
        new_values={
            "placement_status": outcome.placement_status,
            "follow_up_status": outcome.follow_up_status,
        },
    )
    await db.commit()
    await db.refresh(outcome)
    return _outcome_item(outcome)


# ============================================================
# COHORT DASHBOARD
# ============================================================

@router.get("/cohorts/{cohort_id}/dashboard", response_model=CohortDashboard)
async def get_cohort_dashboard(
    cohort_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.PROGRAMMES_VIEW)),
):
    """Roll individual learner records into program-level evidence."""
    cohort = await _load_cohort(db, cohort_id)
    await _require_visible(db, cohort, current_user)

    enrolments = (
        await db.execute(
            select(CohortEnrolment).where(
                CohortEnrolment.cohort_id == cohort.id,
                CohortEnrolment.status != "withdrawn",
            )
        )
    ).scalars().all()
    enrolment_ids = [e.id for e in enrolments]
    enrolment_by_id = {str(e.id): e for e in enrolments}

    assignments = []
    tasks = []
    evidence = []
    assessments = []
    baselines = []
    outcomes_count = 0
    if enrolment_ids:
        assignments = (
            await db.execute(
                select(ModuleAssignment).where(
                    ModuleAssignment.enrolment_id.in_(enrolment_ids)
                )
            )
        ).scalars().all()
        assignment_ids = [a.id for a in assignments]
        if assignment_ids:
            tasks = (
                await db.execute(
                    select(PracticalTask).where(
                        PracticalTask.assignment_id.in_(assignment_ids)
                    )
                )
            ).scalars().all()
        task_ids = [t.id for t in tasks]
        if task_ids:
            evidence = (
                await db.execute(
                    select(EvidenceRecord).where(EvidenceRecord.task_id.in_(task_ids))
                )
            ).scalars().all()
        evidence_ids = [e.id for e in evidence]
        if evidence_ids:
            assessments = (
                await db.execute(
                    select(MentorAssessment).where(
                        MentorAssessment.evidence_id.in_(evidence_ids)
                    )
                )
            ).scalars().all()
        baselines = (
            await db.execute(
                select(LearnerBaseline).where(
                    LearnerBaseline.enrolment_id.in_(enrolment_ids)
                )
            )
        ).scalars().all()
        outcomes_count = len(
            (
                await db.execute(
                    select(LearnerOutcome.id).where(
                        LearnerOutcome.enrolment_id.in_(enrolment_ids)
                    )
                )
            ).scalars().all()
        )

    active_learners = len(enrolments)
    completed_learners = sum(1 for e in enrolments if e.status == "completed")
    assignments_completed = sum(1 for a in assignments if a.status == "completed")
    tasks_completed = sum(1 for t in tasks if t.status == "completed")
    completion_rate = (
        round(assignments_completed / len(assignments) * 100, 1)
        if assignments
        else 0.0
    )

    assessed_evidence_ids = {str(a.evidence_id) for a in assessments}
    task_by_id = {str(t.id): t for t in tasks}
    assignment_by_id = {str(a.id): a for a in assignments}
    today = date.today()

    overdue: List[OverdueEvidenceItem] = []
    for record in evidence:
        if str(record.id) in assessed_evidence_ids:
            continue
        submitted_on = record.recorded_on or (
            record.created_at.date() if record.created_at else today
        )
        days_waiting = (today - submitted_on).days
        if days_waiting <= OVERDUE_ASSESSMENT_DAYS:
            continue
        task = task_by_id.get(str(record.task_id))
        assignment = (
            assignment_by_id.get(str(task.assignment_id)) if task else None
        )
        enrolment = (
            enrolment_by_id.get(str(assignment.enrolment_id)) if assignment else None
        )
        overdue.append(
            OverdueEvidenceItem(
                evidence_id=str(record.id),
                person=_required_person_brief(enrolment.person if enrolment else None),
                task_title=task.title if task else "",
                submitted_on=submitted_on,
                days_waiting=days_waiting,
            )
        )
    overdue.sort(key=lambda item: item.days_waiting, reverse=True)

    follow_ups: List[FollowUpItem] = []
    seen_enrolments = set()
    for assignment in assignments:
        if assignment.status != "follow_up":
            continue
        key = str(assignment.enrolment_id)
        if key in seen_enrolments:
            continue
        seen_enrolments.add(key)
        enrolment = enrolment_by_id.get(key)
        follow_ups.append(
            FollowUpItem(
                enrolment_id=key,
                person=_required_person_brief(enrolment.person if enrolment else None),
                next_action=assignment.next_action,
            )
        )

    vulnerability = None
    if await _can_view_baseline(db, current_user):
        counts = {"low": 0, "moderate": 0, "high": 0}
        for baseline in baselines:
            if baseline.vulnerability_class in counts:
                counts[baseline.vulnerability_class] += 1
        vulnerability = VulnerabilitySummary(
            recorded=len(baselines),
            low=counts["low"],
            moderate=counts["moderate"],
            high=counts["high"],
            high_percent=(
                round(counts["high"] / active_learners * 100, 1)
                if active_learners and baselines
                else None
            ),
        )

    programme = cohort.programme
    return CohortDashboard(
        cohort_id=str(cohort.id),
        cohort_name=cohort.name,
        programme_name=programme.name if programme else "",
        active_learners=active_learners,
        completed_learners=completed_learners,
        assignments_total=len(assignments),
        assignments_completed=assignments_completed,
        module_completion_rate=completion_rate,
        competencies_demonstrated=assignments_completed,
        competencies_pending=len(assignments) - assignments_completed,
        tasks_total=len(tasks),
        tasks_completed=tasks_completed,
        evidence_submissions=len(evidence),
        assessments_completed=len(assessments),
        assessments_overdue=len(overdue),
        learners_needing_follow_up=follow_ups,
        overdue_evidence=overdue,
        vulnerability=vulnerability,
        outcomes_recorded=outcomes_count,
    )
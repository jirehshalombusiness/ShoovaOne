from sqlalchemy import (
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class LearnerBaseline(BaseModel):
    """Socioeconomic baseline for one enrolment. Restricted: programmes.view_baseline."""

    __tablename__ = "learner_baselines"
    __table_args__ = (
        UniqueConstraint(
            "enrolment_id",
            name="uq_learner_baselines_enrolment",
        ),
    )

    enrolment_id = Column(
        GUID,
        ForeignKey("cohort_enrolments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    household_income_band = Column(String(50), nullable=True)
    employment_status = Column(String(50), nullable=True)
    can_afford_training = Column(String(20), nullable=True)
    device_access = Column(String(50), nullable=True)
    internet_access = Column(String(50), nullable=True)
    transport_constraints = Column(Text, nullable=True)
    education_status = Column(String(50), nullable=True)
    household_dependents = Column(Integer, nullable=True)
    vulnerability_class = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )
    recorded_on = Column(Date, nullable=True)

    enrolment = relationship("CohortEnrolment")
    recorder = relationship("Person", lazy="selectin")


class ModuleAssignment(BaseModel):
    """A course assigned to one learner, with the competency it must prove."""

    __tablename__ = "module_assignments"
    __table_args__ = (
        UniqueConstraint(
            "enrolment_id",
            "course_id",
            name="uq_module_assignments_enrolment_course",
        ),
    )

    enrolment_id = Column(
        GUID,
        ForeignKey("cohort_enrolments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id = Column(
        GUID,
        ForeignKey("programme_courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    competency = Column(String(300), nullable=False)
    assigned_on = Column(Date, nullable=True)
    due_on = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="assigned", index=True)
    next_action = Column(String(300), nullable=True)
    completed_on = Column(Date, nullable=True)

    enrolment = relationship("CohortEnrolment")
    course = relationship("ProgrammeCourse", lazy="selectin")


class PracticalTask(BaseModel):
    """A field or practical task attached to a module assignment."""

    __tablename__ = "practical_tasks"

    assignment_id = Column(
        GUID,
        ForeignKey("module_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    instructions = Column(Text, nullable=True)
    safety_requirements = Column(Text, nullable=True)
    expected_evidence = Column(Text, nullable=True)
    due_on = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="assigned", index=True)
    completed_on = Column(Date, nullable=True)

    assignment = relationship("ModuleAssignment")


class EvidenceRecord(BaseModel):
    """One piece of learner evidence submitted against a practical task."""

    __tablename__ = "evidence_records"

    task_id = Column(
        GUID,
        ForeignKey("practical_tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_type = Column(String(30), nullable=False, default="note")
    document_id = Column(
        GUID,
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    file_url = Column(Text, nullable=True)
    field_notes = Column(Text, nullable=True)
    reflection = Column(Text, nullable=True)
    gps_lat = Column(Float, nullable=True)
    gps_lng = Column(Float, nullable=True)
    location_label = Column(String(255), nullable=True)
    recorded_on = Column(Date, nullable=True)
    submitted_by = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
    )

    task = relationship("PracticalTask")
    document = relationship("Document", lazy="selectin")
    submitter = relationship("Person", lazy="selectin")


class MentorAssessment(BaseModel):
    """A mentor's review of one evidence record. The latest result drives progress."""

    __tablename__ = "mentor_assessments"

    evidence_id = Column(
        GUID,
        ForeignKey("evidence_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mentor_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assessed_on = Column(Date, nullable=True)
    competency_result = Column(String(20), nullable=False)
    feedback = Column(Text, nullable=True)
    follow_up = Column(Text, nullable=True)
    evidence_quality = Column(String(20), nullable=True)

    evidence = relationship("EvidenceRecord")
    mentor = relationship("Person", lazy="selectin")


class LearnerOutcome(BaseModel):
    """Outcome record for one enrolment, captured at or after completion."""

    __tablename__ = "learner_outcomes"
    __table_args__ = (
        UniqueConstraint(
            "enrolment_id",
            name="uq_learner_outcomes_enrolment",
        ),
    )

    enrolment_id = Column(
        GUID,
        ForeignKey("cohort_enrolments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    demonstrated_skills = Column(Text, nullable=True)
    field_outputs = Column(Text, nullable=True)
    further_training = Column(Text, nullable=True)
    placement_status = Column(String(50), nullable=True)
    follow_up_status = Column(String(50), nullable=True)
    follow_up_on = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    enrolment = relationship("CohortEnrolment")
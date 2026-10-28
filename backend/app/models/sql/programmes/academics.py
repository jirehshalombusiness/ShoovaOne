from sqlalchemy import (
    Boolean,
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


class ProgrammeCourse(BaseModel):
    """One course in a programme's curriculum."""

    __tablename__ = "programme_courses"
    __table_args__ = (
        UniqueConstraint(
            "programme_id",
            "code",
            name="uq_programme_courses_programme_code",
        ),
    )

    programme_id = Column(
        GUID,
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(50), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sequence = Column(Integer, nullable=False, default=0)
    contact_hours = Column(Integer, nullable=True)
    learning_outcomes = Column(Text, nullable=True)
    is_optional = Column(Boolean, nullable=False, default=False)

    programme = relationship("Programme")


class ProgrammeCohort(BaseModel):
    """A delivery intake of a programme: dates, capacity, roster."""

    __tablename__ = "programme_cohorts"
    __table_args__ = (
        UniqueConstraint(
            "programme_id",
            "code",
            name="uq_programme_cohorts_programme_code",
        ),
    )

    programme_id = Column(
        GUID,
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)

    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True)
    enrolment_opens_on = Column(Date, nullable=True)
    enrolment_closes_on = Column(Date, nullable=True)

    capacity = Column(Integer, nullable=True)
    delivery_mode = Column(String(20), nullable=False, default="in_person")
    location = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="planned", index=True)
    notes = Column(Text, nullable=True)

    programme = relationship("Programme", lazy="selectin")


class CohortInstructor(BaseModel):
    __tablename__ = "cohort_instructors"
    __table_args__ = (
        UniqueConstraint(
            "cohort_id",
            "person_id",
            name="uq_cohort_instructors_cohort_person",
        ),
    )

    cohort_id = Column(
        GUID,
        ForeignKey("programme_cohorts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False, default="instructor")

    person = relationship("Person", lazy="selectin")


class CohortEnrolment(BaseModel):
    """A learner's place on a cohort."""

    __tablename__ = "cohort_enrolments"
    __table_args__ = (
        UniqueConstraint(
            "cohort_id",
            "person_id",
            name="uq_cohort_enrolments_cohort_person",
        ),
    )

    cohort_id = Column(
        GUID,
        ForeignKey("programme_cohorts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status = Column(String(20), nullable=False, default="enrolled", index=True)
    enrolled_on = Column(Date, nullable=True)
    completed_on = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    person = relationship("Person", lazy="selectin")


class EnrolmentResult(BaseModel):
    """A learner's result in one course of the programme."""

    __tablename__ = "enrolment_results"
    __table_args__ = (
        UniqueConstraint(
            "enrolment_id",
            "course_id",
            name="uq_enrolment_results_enrolment_course",
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
    score = Column(Float, nullable=True)
    grade = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="pending")

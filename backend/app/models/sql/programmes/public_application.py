from sqlalchemy import Column, ForeignKey, String, Text, UniqueConstraint

from app.models.sql.base import BaseModel, GUID


class ProgrammeApplication(BaseModel):
    """Public application submitted for a specific programme cohort."""

    __tablename__ = "programme_applications"
    __table_args__ = (
        UniqueConstraint(
            "cohort_id",
            "applicant_email",
            name="uq_programme_applications_cohort_email",
        ),
    )

    reference = Column(String(32), nullable=False, unique=True, index=True)
    programme_id = Column(
        GUID,
        ForeignKey("programmes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cohort_id = Column(
        GUID,
        ForeignKey("programme_cohorts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    applicant_name = Column(String(200), nullable=False)
    applicant_email = Column(String(320), nullable=False)
    applicant_phone = Column(String(50), nullable=True)
    motivation = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="submitted")

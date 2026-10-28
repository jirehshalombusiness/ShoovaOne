from sqlalchemy import Column, String, Text, Date, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Organisation(BaseModel):
    __tablename__ = "organisations"

    name = Column(String(200), nullable=False)
    code = Column(String(50), unique=True, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="active")

    departments = relationship(
        "Department",
        back_populates="organisation",
        cascade="all, delete-orphan",
    )

    programmes = relationship(
        "Programme",
        back_populates="organisation",
        cascade="all, delete-orphan",
    )

    projects = relationship(
        "Project",
        back_populates="organisation",
    )


class Department(BaseModel):
    __tablename__ = "departments"

    organisation_id = Column(
        GUID,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="active")

    organisation = relationship(
        "Organisation",
        back_populates="departments",
    )

    programmes = relationship(
        "Programme",
        back_populates="department",
    )

    projects = relationship(
        "Project",
        back_populates="department",
    )


class Programme(BaseModel):
    __tablename__ = "programmes"

    organisation_id = Column(
        GUID,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
    )
    department_id = Column(
        GUID,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = Column(String(200), nullable=False)
    code = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="active")
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # Academic fields used by the programme module.
    level = Column(String(30), nullable=True)
    duration_weeks = Column(Integer, nullable=True)
    learning_outcomes = Column(Text, nullable=True)
    lead_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    organisation = relationship(
        "Organisation",
        back_populates="programmes",
        lazy="selectin",
    )

    department = relationship(
        "Department",
        back_populates="programmes",
        lazy="selectin",
    )

    lead = relationship("Person", lazy="selectin")

    projects = relationship(
        "Project",
        back_populates="programme",
    )

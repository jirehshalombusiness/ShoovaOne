from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Date, Time, DECIMAL, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from decimal import Decimal

from app.models.sql.base import BaseModel
from app.core.config import settings

if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)


class Timesheet(BaseModel):
    __tablename__ = "timesheets"

    person_id = Column(FK_TYPE, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)
    status = Column(String(20), default="draft")
    total_hours = Column(DECIMAL(5, 2), default=0)
    expected_hours = Column(DECIMAL(5, 2), default=40)
    submitted_at = Column(DateTime(timezone=True))
    submitted_by = Column(FK_TYPE, ForeignKey("people.id"))
    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(FK_TYPE, ForeignKey("people.id"))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    person = relationship("Person", foreign_keys=[person_id])
    entries = relationship("TimesheetEntry", back_populates="timesheet", cascade="all, delete-orphan")
    submitter = relationship("Person", foreign_keys=[submitted_by])
    approver = relationship("Person", foreign_keys=[approved_by])


class TimesheetEntry(BaseModel):
    __tablename__ = "timesheet_entries"

    timesheet_id = Column(FK_TYPE, ForeignKey("timesheets.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    project_id = Column(FK_TYPE, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    task_id = Column(FK_TYPE, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    start_time = Column(Time)
    end_time = Column(Time)
    break_minutes = Column(Integer, default=0)
    duration = Column(DECIMAL(5, 2), nullable=False)
    description = Column(Text)
    is_billable = Column(String(10), default="yes")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    timesheet = relationship("Timesheet", back_populates="entries")
    project = relationship("Project", foreign_keys=[project_id])
    task = relationship("Task", foreign_keys=[task_id])


class TimesheetApprovalHistory(BaseModel):
    __tablename__ = "timesheet_approval_history"

    timesheet_id = Column(FK_TYPE, ForeignKey("timesheets.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(20), nullable=False)
    performed_by = Column(FK_TYPE, ForeignKey("people.id"), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    timesheet = relationship("Timesheet")
    performer = relationship("Person", foreign_keys=[performed_by])
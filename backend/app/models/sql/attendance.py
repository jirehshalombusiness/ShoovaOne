from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Date, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class Attendance(BaseModel):
    __tablename__ = "attendance"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime(timezone=True))
    check_out = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    status = Column(String(50), default="present")
    notes = Column(String)
    check_in_location = Column(JSON)
    check_out_location = Column(JSON)

    # NEW
    planned_task_ids = Column(JSON, default=list)
    completed_task_ids = Column(JSON, default=list)
    adhoc_tasks = Column(JSON, default=list)
    confirmed_at = Column(DateTime(timezone=True))
    checkout_notes = Column(Text)

    work_type = Column(String(20), default="office")
    current_status = Column(String(20), default="not_started")
    overtime_minutes = Column(Integer, default=0)
    standard_minutes = Column(Integer, default=0)
    last_heartbeat_at = Column(DateTime(timezone=True))

    # Relationships
    person = relationship("Person", back_populates="attendance", lazy="selectin")
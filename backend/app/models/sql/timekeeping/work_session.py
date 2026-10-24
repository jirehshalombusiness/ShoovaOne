from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class WorkSession(BaseModel):
    __tablename__ = "work_sessions"

    attendance_id = Column(GUID, ForeignKey("attendance.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_activity_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer, default=0)
    status = Column(String(20), default="active")
    end_reason = Column(String(50))

    # Relationships
    attendance = relationship("Attendance")
    person = relationship("Person", lazy="selectin")
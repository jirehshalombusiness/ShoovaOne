from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel
from app.core.config import settings

# Determine column type based on database
if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)


class Attendance(BaseModel):
    __tablename__ = "attendance"

    person_id = Column(FK_TYPE, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    check_in = Column(DateTime(timezone=True))
    check_out = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer)
    status = Column(String(50), default="present")
    notes = Column(String)
    check_in_location = Column(JSON)
    check_out_location = Column(JSON)

    # Relationships
    person = relationship("Person", back_populates="attendance", lazy="selectin")
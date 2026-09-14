from sqlalchemy import Column, String, ForeignKey, Date, Text
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class HRCelebration(BaseModel):
    __tablename__ = "hr_celebrations"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    celebration_date = Column(Date, nullable=False)
    title = Column(String(200))
    notes = Column(Text)

    person = relationship("Person", lazy="selectin")
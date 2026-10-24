from sqlalchemy import Column, String, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class HRNote(BaseModel):
    __tablename__ = "hr_notes"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(GUID, ForeignKey("people.id"))
    category = Column(String(50), default="general")
    title = Column(String(200))
    content = Column(Text, nullable=False)
    is_sensitive = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
    author = relationship("Person", foreign_keys=[author_id], lazy="selectin")
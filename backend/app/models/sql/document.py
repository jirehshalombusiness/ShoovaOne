from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class Document(BaseModel):
    __tablename__ = "documents"

    name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_size_bytes = Column(BigInteger)
    mime_type = Column(String(100))
    type = Column(String(50), default="project")
    owner_id = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"))
    related_entity_type = Column(String(50))
    related_entity_id = Column(GUID)
    visibility = Column(String(50), default="internal")
    version = Column(Integer, default=1)
    deleted_at = Column(DateTime(timezone=True))

    owner = relationship("Person", lazy="selectin")
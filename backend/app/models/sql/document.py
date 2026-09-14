from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, BigInteger, Boolean, Date
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

    # Add to imports


# Add these fields to the Document class:
document_type_id = Column(GUID, ForeignKey("document_types.id", ondelete="SET NULL"))
expiry_date = Column(Date)
verified = Column(Boolean, default=False)
verified_by = Column(GUID, ForeignKey("people.id"))
verified_at = Column(DateTime(timezone=True))
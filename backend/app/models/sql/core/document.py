from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Text,
    BigInteger,
    Boolean,
    Date,
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class Document(BaseModel):
    __tablename__ = "documents"

    # ---- core fields ----
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

    # ---- HR / verification fields ----
    document_type_id = Column(
        GUID,
        ForeignKey("document_types.id", ondelete="SET NULL"),
    )
    expiry_date = Column(Date)
    verified = Column(Boolean, default=False)
    verified_by = Column(GUID, ForeignKey("people.id", ondelete="SET NULL"))
    verified_at = Column(DateTime(timezone=True))

    # ---- relationships ----
    # Note: foreign_keys is required because Document has two FKs to people
    # (owner_id and verified_by). Without it, SQLAlchemy cannot resolve
    # which foreign key defines the relationship.
    owner = relationship(
        "Person",
        foreign_keys=[owner_id],
        lazy="selectin",
    )
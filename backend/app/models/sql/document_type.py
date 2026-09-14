from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel


class DocumentType(BaseModel):
    __tablename__ = "document_types"

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    is_required = Column(Boolean, default=True)
    applies_to = Column(String(50), default="all")
    validity_months = Column(Integer)
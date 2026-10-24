import sqlalchemy
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel


class DocumentType(BaseModel):
    __tablename__ = "document_types"

    name = sqlalchemy.Column(sqlalchemy.String(100), nullable=False, unique=True)
    description = sqlalchemy.Column(sqlalchemy.Text)
    is_required = sqlalchemy.Column(sqlalchemy.Boolean, default=True)
    applies_to = sqlalchemy.Column(sqlalchemy.String(50), default="all")
    validity_months = sqlalchemy.Column(sqlalchemy.Integer)
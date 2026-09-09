from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel
from app.core.config import settings

# Determine column type based on database
if settings.DATABASE_URL.startswith("sqlite://"):
    FK_TYPE = String(36)
else:
    FK_TYPE = UUID(as_uuid=True)


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = Column(FK_TYPE, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(String)
    type = Column(String(50), default="info")
    is_read = Column(Boolean, default=False)
    link = Column(String)
    extra_data = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    read_at = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="notifications", lazy="selectin")
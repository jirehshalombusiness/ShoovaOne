from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.sql.base import BaseModel, GUID


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text)
    type = Column(String(50), default="info")
    is_read = Column(Boolean, default=False)
    link = Column(String)
    extra_data = Column(Text)
    read_at = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="notifications", lazy="selectin")
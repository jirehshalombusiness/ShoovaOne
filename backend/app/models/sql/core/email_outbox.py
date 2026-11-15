from sqlalchemy import Column, DateTime, Integer, String, Text

from app.models.sql.base import BaseModel


class EmailOutbox(BaseModel):
    """A message queued inside a transaction and delivered by the drainer."""

    __tablename__ = "email_outbox"

    to_address = Column(String(320), nullable=False)
    subject = Column(String(500), nullable=False)
    html = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

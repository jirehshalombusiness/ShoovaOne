from sqlalchemy import (
    Column, String, Date, DECIMAL, ForeignKey, Text, DateTime
)
from sqlalchemy.orm import relationship

from app.models.sql.base import BaseModel, GUID


class CompensationChange(BaseModel):
    __tablename__ = "compensation_changes"

    person_id = Column(
        GUID,
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    base_amount = Column(DECIMAL(15, 2), nullable=False)
    currency = Column(String(3), default="GHS", nullable=False)
    frequency = Column(String(20), default="monthly", nullable=False)
    effective_from = Column(Date, nullable=False, index=True)
    effective_to = Column(Date, nullable=True)
    reason = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    approved_by_id = Column(GUID, ForeignKey("people.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
    approver = relationship("Person", foreign_keys=[approved_by_id], lazy="selectin")
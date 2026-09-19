from sqlalchemy import Column, String, Date, DECIMAL, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.sql.base import BaseModel, GUID


class EmploymentContract(BaseModel):
    __tablename__ = "employment_contracts"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    contract_type = Column(String(50), nullable=False)
    position = Column(String(200))
    department = Column(String(200))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    reports_to_id = Column(GUID, ForeignKey("people.id"))
    compensation_amount = Column(DECIMAL(15, 2))
    compensation_currency = Column(String(3), default="GHS")
    compensation_frequency = Column(String(20), default="monthly")
    document_id = Column(GUID, ForeignKey("documents.id"))
    is_current = Column(Boolean, default=True)
    notes = Column(Text)

    reports_to = relationship("Person", foreign_keys=[reports_to_id], lazy="selectin")
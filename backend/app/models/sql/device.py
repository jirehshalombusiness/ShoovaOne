from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.sql.base import BaseModel, GUID


class Device(BaseModel):
    __tablename__ = "devices"

    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    serial_number = Column(String(100))
    brand = Column(String(100))
    model = Column(String(100))
    purchase_date = Column(Date)
    condition = Column(String(50), default="good")
    notes = Column(Text)


class DeviceAssignment(BaseModel):
    __tablename__ = "device_assignments"

    device_id = Column(GUID, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(DateTime(timezone=True))
    returned_at = Column(DateTime(timezone=True))
    assigned_by = Column(GUID, ForeignKey("people.id"))
    condition_on_assignment = Column(String(50))
    condition_on_return = Column(String(50))
    notes = Column(Text)

    device = relationship("Device", lazy="selectin")
    person = relationship("Person", foreign_keys=[person_id], lazy="selectin")
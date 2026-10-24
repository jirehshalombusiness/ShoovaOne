from sqlalchemy import Column, String, Integer, Date, DateTime, DECIMAL, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.sql.base import BaseModel, GUID


class LeaveType(BaseModel):
    __tablename__ = "leave_types"

    name = Column(String(100), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)
    default_days = Column(Integer, default=0)
    is_paid = Column(Boolean, default=True)
    requires_approval = Column(Boolean, default=True)
    requires_documentation = Column(Boolean, default=False)
    color = Column(String(20), default="#176b4d")
    is_active = Column(Boolean, default=True)


class LeaveBalance(BaseModel):
    __tablename__ = "leave_balances"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(GUID, ForeignKey("leave_types.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    total_days = Column(DECIMAL(5, 1), nullable=False)
    used_days = Column(DECIMAL(5, 1), default=0)
    pending_days = Column(DECIMAL(5, 1), default=0)
    carry_over_days = Column(DECIMAL(5, 1), default=0)

    leave_type = relationship("LeaveType", lazy="selectin")


class LeaveRequest(BaseModel):
    __tablename__ = "leave_requests"

    person_id = Column(GUID, ForeignKey("people.id", ondelete="CASCADE"), nullable=False)
    leave_type_id = Column(GUID, ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(DECIMAL(5, 1), nullable=False)
    reason = Column(Text)
    status = Column(String(30), default="pending")
    approved_by = Column(GUID, ForeignKey("people.id"))
    approved_at = Column(DateTime(timezone=True))
    rejection_reason = Column(Text)

    leave_type = relationship("LeaveType", lazy="selectin")
    approver = relationship("Person", foreign_keys=[approved_by], lazy="selectin")
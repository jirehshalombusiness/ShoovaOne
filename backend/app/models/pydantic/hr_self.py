from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional, List


class HolidayResponse(BaseModel):
    id: str
    name: str
    holiday_date: date
    country: str
    is_paid: bool

    @field_validator("id", mode="before")
    @classmethod
    def conv(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


class LeaveTypeResponse(BaseModel):
    id: str
    name: str
    code: str
    default_days: int
    is_paid: bool
    color: str

    @field_validator("id", mode="before")
    @classmethod
    def conv(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


class LeaveBalanceResponse(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    year: int
    total_days: float
    used_days: float
    pending_days: float
    carry_over_days: float
    remaining_days: float


class LeaveRequestResponse(BaseModel):
    id: str
    leave_type_id: str
    leave_type_name: str
    leave_type_color: str
    start_date: date
    end_date: date
    total_days: float
    reason: Optional[str]
    status: str
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime

    @field_validator("id", "leave_type_id", mode="before")
    @classmethod
    def conv(cls, v):
        return str(v) if v else v


class LeaveRequestCreate(BaseModel):
    leave_type_id: str
    start_date: date
    end_date: date
    reason: Optional[str] = None
    attachment_ids: Optional[List[str]] = []


class DeviceResponse(BaseModel):
    id: str
    name: str
    category: str
    serial_number: Optional[str]
    brand: Optional[str]
    model: Optional[str]
    condition: str
    assigned_at: Optional[datetime]

    @field_validator("id", mode="before")
    @classmethod
    def conv(cls, v):
        return str(v) if v else v


class ContractResponse(BaseModel):
    id: str
    contract_type: str
    position: Optional[str]
    department: Optional[str]
    start_date: date
    end_date: Optional[date]
    reports_to_id: Optional[str]
    reports_to_name: Optional[str]
    compensation_amount: Optional[float]
    compensation_currency: str
    compensation_frequency: str
    document_id: Optional[str]
    is_current: bool

    @field_validator("id", "reports_to_id", "document_id", mode="before")
    @classmethod
    def conv(cls, v):
        return str(v) if v else v


class MyHRHomeResponse(BaseModel):
    person: dict
    balances: List[LeaveBalanceResponse]
    upcoming_holidays: List[HolidayResponse]
    recent_requests: List[LeaveRequestResponse]
    devices_count: int
    documents_pending: int
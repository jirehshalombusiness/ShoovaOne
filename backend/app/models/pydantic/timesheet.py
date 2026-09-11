from pydantic import BaseModel, field_validator
from datetime import datetime, date, time
from typing import Optional, List
from decimal import Decimal


# =============================================
# TIMESHEET ENTRY
# =============================================

class TimesheetEntryBase(BaseModel):
    date: date
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: int = 0
    duration: Decimal
    description: Optional[str] = None
    is_billable: str = "yes"


class TimesheetEntryCreate(TimesheetEntryBase):
    timesheet_id: str


class TimesheetEntryUpdate(BaseModel):
    date: Optional[date] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: Optional[int] = None
    duration: Optional[Decimal] = None
    description: Optional[str] = None
    is_billable: Optional[str] = None


class TimesheetEntryResponse(TimesheetEntryBase):
    id: str
    timesheet_id: str
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'timesheet_id', 'project_id', 'task_id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


# =============================================
# TIMESHEET
# =============================================

class TimesheetBase(BaseModel):
    week_start_date: date
    week_end_date: date
    expected_hours: Decimal = 40
    notes: Optional[str] = None


class TimesheetCreate(TimesheetBase):
    person_id: str


class TimesheetUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class TimesheetResponse(TimesheetBase):
    id: str
    person_id: str
    status: str
    total_hours: Decimal
    submitted_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    entries: List[TimesheetEntryResponse] = []

    @field_validator('id', 'person_id', 'submitted_by', 'approved_by', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


# =============================================
# APPROVAL HISTORY
# =============================================

class TimesheetApprovalHistoryResponse(BaseModel):
    id: str
    timesheet_id: str
    action: str
    performed_by: str
    comment: Optional[str] = None
    created_at: datetime

    @field_validator('id', 'timesheet_id', 'performed_by', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


# =============================================
# ACTIONS
# =============================================

class TimesheetSubmit(BaseModel):
    timesheet_id: str


class TimesheetApprove(BaseModel):
    timesheet_id: str
    comment: Optional[str] = None


class TimesheetReturn(BaseModel):
    timesheet_id: str
    comment: str
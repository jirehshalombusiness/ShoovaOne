from pydantic import BaseModel
from datetime import datetime, date as date_type, time
from typing import Optional, List
from decimal import Decimal
from uuid import UUID


class TimesheetEntryBase(BaseModel):
    date: date_type
    project_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: int = 0
    duration: Decimal
    description: Optional[str] = None
    is_billable: str = "yes"


class TimesheetEntryCreate(TimesheetEntryBase):
    timesheet_id: UUID


class TimesheetEntryUpdate(BaseModel):
    date: Optional[date_type] = None
    project_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: Optional[int] = None
    duration: Optional[Decimal] = None
    description: Optional[str] = None
    is_billable: Optional[str] = None


class TimesheetEntryResponse(TimesheetEntryBase):
    id: UUID
    timesheet_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimesheetBase(BaseModel):
    week_start_date: date_type
    week_end_date: date_type
    expected_hours: Decimal = 40
    notes: Optional[str] = None


class TimesheetCreate(TimesheetBase):
    person_id: UUID


class TimesheetUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


class TimesheetResponse(TimesheetBase):
    id: UUID
    person_id: UUID
    status: str
    total_hours: Decimal
    submitted_at: Optional[datetime]
    submitted_by: Optional[UUID]
    approved_at: Optional[datetime]
    approved_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    entries: List[TimesheetEntryResponse] = []

    class Config:
        from_attributes = True


class TimesheetApprovalHistoryResponse(BaseModel):
    id: UUID
    timesheet_id: UUID
    action: str
    performed_by: UUID
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TimesheetSubmit(BaseModel):
    timesheet_id: UUID


class TimesheetApprove(BaseModel):
    timesheet_id: UUID
    comment: Optional[str] = None


class TimesheetReturn(BaseModel):
    timesheet_id: UUID
    comment: str
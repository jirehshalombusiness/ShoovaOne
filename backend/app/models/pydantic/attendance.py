from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional
from uuid import UUID


class AttendanceBase(BaseModel):
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str = "present"
    notes: Optional[str] = None


class AttendanceCreate(AttendanceBase):
    person_id: UUID


class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: UUID
    person_id: UUID
    duration_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'person_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
        json_encoders = {UUID: str}
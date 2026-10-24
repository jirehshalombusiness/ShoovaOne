from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional


# =============================================
# BASE
# =============================================

class AttendanceBase(BaseModel):
    date: date
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: str = "present"
    notes: Optional[str] = None


# =============================================
# CREATE
# =============================================

class AttendanceCreate(AttendanceBase):
    person_id: str


# =============================================
# UPDATE
# =============================================

class AttendanceUpdate(BaseModel):
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None


# =============================================
# RESPONSE
# =============================================

class AttendanceResponse(AttendanceBase):
    id: str
    person_id: str
    duration_minutes: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'person_id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
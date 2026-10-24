from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


# =============================================
# BASE
# =============================================

class NotificationBase(BaseModel):
    title: str
    body: str
    type: str = "info"
    link: Optional[str] = None
    extra_data: Optional[str] = None


# =============================================
# CREATE
# =============================================

class NotificationCreate(NotificationBase):
    user_id: str


# =============================================
# RESPONSE
# =============================================

class NotificationResponse(NotificationBase):
    id: str
    user_id: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
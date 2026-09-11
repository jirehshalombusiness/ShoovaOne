from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
from uuid import UUID


class NotificationBase(BaseModel):
    title: str
    body: str
    type: str = "info"
    link: Optional[str] = None
    extra_data: Optional[str] = None


class NotificationCreate(NotificationBase):
    user_id: UUID


class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    @field_validator('id', 'user_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
        json_encoders = {UUID: str}
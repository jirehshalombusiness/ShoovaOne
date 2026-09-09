from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from uuid import UUID


class NotificationBase(BaseModel):
    title: str
    body: str
    type: str = "info"
    link: Optional[str] = None
    extra_data: Optional[str] = None  # Changed from 'metadata'


class NotificationCreate(NotificationBase):
    user_id: UUID


class NotificationResponse(NotificationBase):
    id: UUID
    user_id: UUID
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime]

    class Config:
        from_attributes = True
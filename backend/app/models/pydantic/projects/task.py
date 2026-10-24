from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    assignee_id: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[float] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None


class TaskResponse(TaskBase):
    id: str
    project_id: Optional[str] = None
    reporter_id: Optional[str] = None
    assignee_first_name: Optional[str] = None
    assignee_last_name: Optional[str] = None
    assignee_image_url: Optional[str] = None
    completed_at: Optional[datetime] = None
    actual_hours: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id", "project_id", "assignee_id", "reporter_id", mode="before")
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
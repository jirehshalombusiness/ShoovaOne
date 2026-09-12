from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator


class ProjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: str = "planning"
    priority: str = "medium"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    organisation_id: Optional[str] = None
    budget: Optional[Decimal] = None
    actual_cost: Optional[Decimal] = None
    progress: int = 0


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    manager_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    organisation_id: Optional[str] = None
    budget: Optional[Decimal] = None
    actual_cost: Optional[Decimal] = None
    progress: Optional[int] = None


class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    person_id: str
    role: str
    joined_at: Optional[datetime] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None


class ProjectMemberCreate(BaseModel):
    project_id: Optional[str] = None
    person_id: str
    role: str = "member"


class MilestoneBase(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "pending"
    position: int = 0


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    status: Optional[str] = None
    position: Optional[int] = None


class MilestoneResponse(MilestoneBase):
    id: str
    project_id: str
    completed_at: Optional[datetime] = None


class ProjectResponse(ProjectBase):
    id: str
    created_at: datetime
    updated_at: datetime
    manager_first_name: Optional[str] = None
    manager_last_name: Optional[str] = None
    manager_image_url: Optional[str] = None
    task_count: int = 0
    completed_task_count: int = 0
    member_count: int = 0
    members: list[ProjectMemberResponse] = []
    milestones: list[MilestoneResponse] = []

    @field_validator(
        "id",
        "manager_id",
        "department_id",
        "programme_id",
        "organisation_id",
        mode="before",
    )
    @classmethod
    def convert_ids_to_str(cls, value):
        return str(value) if value is not None else None

from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List


class PersonBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    type: str = "staff"
    status: Optional[str] = "active"
    job_title: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    reports_to_id: Optional[str] = None
    profile_image_url: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[str] = None
    department: Optional[str] = None
    employee_number: Optional[str] = None


class PersonCreate(PersonBase):
    pass


class PersonUpdate(PersonBase):
    pass


class PersonResponse(PersonBase):
    id: str
    created_at: datetime
    updated_at: datetime
    # Optional: embed manager info
    reports_to_name: Optional[str] = None

    @field_validator('id', 'reports_to_id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


class OrgNode(BaseModel):
    """Simplified person for org chart."""
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    location: Optional[str] = None
    profile_image_url: Optional[str] = None
    reports_to_id: Optional[str] = None
    direct_reports_count: int = 0

    @field_validator('id', 'reports_to_id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


class OrgChartResponse(BaseModel):
    nodes: List[OrgNode]
    roots: List[str]  # person IDs who have no manager
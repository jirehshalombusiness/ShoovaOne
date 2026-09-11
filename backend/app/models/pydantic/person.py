from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional
from uuid import UUID


class PersonBase(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    type: str = "staff"
    status: Optional[str] = "active"
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


class PersonCreate(PersonBase):
    pass


class PersonUpdate(PersonBase):
    pass


class PersonResponse(PersonBase):
    id: UUID  # Accept UUID from database
    created_at: datetime
    updated_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        """Convert UUID to string."""
        return str(v) if v else v

    class Config:
        from_attributes = True
        json_encoders = {
            UUID: str,
        }
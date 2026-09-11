from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional


# =============================================
# BASE
# =============================================

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


# =============================================
# CREATE
# =============================================

class PersonCreate(PersonBase):
    pass


# =============================================
# UPDATE
# =============================================

class PersonUpdate(PersonBase):
    pass


# =============================================
# RESPONSE
# =============================================

class PersonResponse(PersonBase):
    id: str
    created_at: datetime
    updated_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
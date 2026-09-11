from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List


# =============================================
# AUTH MODELS
# =============================================

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    first_name: str
    last_name: str


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    profile_image_url: Optional[str] = None   # ← ADD
    job_title: Optional[str] = None           # ← ADD
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


# =============================================
# MANAGED USER MODELS (Admin operations)
# =============================================

class ManagedUserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool = True
    roles: Optional[List[str]] = []


class ManagedUserCreate(ManagedUserBase):
    password: str


class ManagedUserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    roles: Optional[List[str]] = None
    password: Optional[str] = None


class ManagedUserResponse(ManagedUserBase):
    id: str
    person_id: str
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'person_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
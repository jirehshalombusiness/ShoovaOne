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
    profile_image_url: Optional[str] = None
    job_title: Optional[str] = None
    is_active: bool
    must_change_password: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    roles: List[str] = []
    permissions: List[str] = []

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
    person_id: str
    password: Optional[str] = None
    role_names: List[str] = []


class ManagedUserCreate(ManagedUserBase):
    password: str


class ManagedUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    role_names: Optional[List[str]] = None
    password: Optional[str] = None


class ManagedUserResponse(ManagedUserBase):
    id: str
    person_id: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @field_validator('id', 'person_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
# =============================================
# PASSWORD SECURITY MODELS
# =============================================

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str       
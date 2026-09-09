from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    first_name: str
    last_name: str


class ManagedUserCreate(BaseModel):
    person_id: str
    password: str
    role_names: List[str] = []


class ManagedUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    password: Optional[str] = None
    role_names: Optional[List[str]] = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime
    roles: List[str] = []
    permissions: List[str] = []
    person_id: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
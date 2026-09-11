from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    first_name: str
    last_name: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    is_active: bool
    last_login_at: Optional[datetime]
    created_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
        json_encoders = {UUID: str}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict  # Changed to dict for flexibility
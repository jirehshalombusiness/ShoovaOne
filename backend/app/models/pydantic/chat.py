from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ChatUser(BaseModel):
    id: str
    first_name: str
    last_name: str
    job_title: Optional[str] = None
    department: Optional[str] = None
    profile_image_url: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    conversation_id: str
    body: str
    message_type: str = "text"
    sender: Optional[ChatUser] = None
    created_at: datetime
    edited_at: Optional[datetime] = None


class ChatConversationResponse(BaseModel):
    id: str
    type: str
    title: Optional[str] = None
    description: Optional[str] = None
    status: str
    posting_policy: str
    created_at: datetime
    created_by: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    member_count: int = 0
    members: List[ChatUser] = Field(default_factory=list)
    last_message: Optional[ChatMessageResponse] = None
    requested_members: List[ChatUser] = Field(default_factory=list)
    is_owner: bool = False
    can_post: bool = False


class DirectConversationCreate(BaseModel):
    user_id: str


class GroupCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    requested_member_ids: List[str] = Field(default_factory=list)

    @field_validator('title')
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError('Group name must be at least 2 characters.')
        return cleaned

    @field_validator('description')
    @classmethod
    def clean_description(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else None


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=1000)
    member_ids: List[str] = Field(default_factory=list)

    @field_validator('title')
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError('Announcement name must be at least 2 characters.')
        return cleaned

    @field_validator('description')
    @classmethod
    def clean_description(cls, value: Optional[str]) -> Optional[str]:
        return value.strip() if value else None


class GroupApprovalRequest(BaseModel):
    member_ids: List[str] = Field(default_factory=list)


class AddMembersRequest(BaseModel):
    user_ids: List[str] = Field(default_factory=list)


class MessageCreate(BaseModel):
    body: str = Field(..., max_length=4000)

    @field_validator('body')
    @classmethod
    def validate_body(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError('Message cannot be empty.')
        return cleaned

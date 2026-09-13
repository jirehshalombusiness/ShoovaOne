from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):
    id: str
    name: str
    file_url: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    type: Optional[str] = None
    owner_id: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None
    visibility: str = "internal"
    version: int = 1
    created_at: datetime
    updated_at: datetime

    @field_validator("id", "owner_id", "related_entity_id", mode="before")
    @classmethod
    def convert_to_str(cls, v):
        return str(v) if v else v

    class Config:
        from_attributes = True
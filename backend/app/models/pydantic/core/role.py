from typing import List, Optional

from pydantic import BaseModel, Field


class PermissionResponse(BaseModel):
    id: str
    resource: str
    action: str
    description: Optional[str] = None


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None


class RolePermissionsUpdate(BaseModel):
    permission_ids: List[str] = Field(default_factory=list)


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    user_count: int
    permission_count: int


class RoleDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_system: bool
    user_count: int
    permissions: List[PermissionResponse]
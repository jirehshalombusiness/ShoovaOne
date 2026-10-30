from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


CATEGORIES = (
    "laptop",
    "monitor",
    "phone",
    "sim_card",
    "tablet",
    "peripheral",
    "other",
)


class DeviceRequestCreate(BaseModel):
    category: str = Field(..., max_length=50)
    item_name: str = Field(..., min_length=3, max_length=200)
    justification: Optional[str] = Field(default=None, max_length=4000)
    needed_by: Optional[date] = None

    @field_validator("category")
    @classmethod
    def _valid_category(cls, value: str) -> str:
        normalised = value.strip().lower()
        if normalised not in CATEGORIES:
            raise ValueError(
                f"Category must be one of: {', '.join(CATEGORIES)}"
            )
        return normalised

    @field_validator("item_name")
    @classmethod
    def _clean_item_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Describe the item in at least 3 characters")
        return cleaned


class DeviceRequestUpdate(BaseModel):
    category: Optional[str] = Field(default=None, max_length=50)
    item_name: Optional[str] = Field(default=None, min_length=3, max_length=200)
    justification: Optional[str] = Field(default=None, max_length=4000)
    needed_by: Optional[date] = None

    @field_validator("category")
    @classmethod
    def _valid_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalised = value.strip().lower()
        if normalised not in CATEGORIES:
            raise ValueError(
                f"Category must be one of: {', '.join(CATEGORIES)}"
            )
        return normalised


class DeviceRequestFulfilAssign(BaseModel):
    device_id: str
    note: Optional[str] = Field(default=None, max_length=2000)


class DeviceRequestFulfilPurchase(BaseModel):
    purchase_reference: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)


class DeviceRequestDecisionRecord(BaseModel):
    id: str
    stage: str
    status: str
    decision: str
    decided_by_name: Optional[str] = None
    decided_at: Optional[datetime] = None
    note: Optional[str] = None


class DeviceRequestResponse(BaseModel):
    id: str
    request_number: str
    requester_id: str
    requester_name: str
    category: str
    item_name: str
    justification: Optional[str] = None
    needed_by: Optional[date] = None
    status: str
    current_stage: Optional[str] = None
    fulfilment: Optional[str] = None
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    purchase_reference: Optional[str] = None
    rejection_reason: Optional[str] = None
    manager_decision_note: Optional[str] = None
    hr_decision_note: Optional[str] = None
    submitted_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class DeviceRequestDetailResponse(DeviceRequestResponse):
    approval_history: List[DeviceRequestDecisionRecord] = []


class DeviceStockItem(BaseModel):
    id: str
    name: str
    category: str
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    condition: str

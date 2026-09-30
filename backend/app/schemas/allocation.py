from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class AllocationCreate(BaseModel):
    budget_id: str
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None

    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="GHS", min_length=3, max_length=3)

    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None

    notes: Optional[str] = None


class AllocationUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    description: Optional[str] = None

    amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )

    currency: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=3,
    )

    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None

    notes: Optional[str] = None


class AllocationResponse(BaseModel):
    id: str
    allocation_number: str

    budget_id: str

    name: str
    description: Optional[str] = None

    amount: Decimal
    currency: str

    status: str

    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None

    notes: Optional[str] = None

    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    submitted_by_id: Optional[str] = None
    approved_by_id: Optional[str] = None
    activated_by_id: Optional[str] = None
    closed_by_id: Optional[str] = None
    created_by_id: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class AllocationSubmission(BaseModel):
    notes: Optional[str] = None


class AllocationApproval(BaseModel):
    notes: Optional[str] = None


class AllocationClosure(BaseModel):
    reason: str = Field(..., min_length=3)
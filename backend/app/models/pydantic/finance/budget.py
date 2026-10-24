from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None

    fiscal_year: str = Field(
        ...,
        min_length=4,
        max_length=10,
    )

    start_date: date
    end_date: date

    amount: Decimal = Field(..., gt=0)

    currency: str = Field(
        default="GHS",
        min_length=3,
        max_length=3,
    )

    organisation_id: Optional[str] = None
    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None

    notes: Optional[str] = None


class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=200,
    )

    description: Optional[str] = None

    fiscal_year: Optional[str] = Field(
        default=None,
        min_length=4,
        max_length=10,
    )

    start_date: Optional[date] = None
    end_date: Optional[date] = None

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


class BudgetResponse(BaseModel):
    id: str
    budget_number: str

    name: str
    description: Optional[str] = None

    fiscal_year: str
    start_date: date
    end_date: date

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


class BudgetSubmission(BaseModel):
    notes: Optional[str] = None


class BudgetApproval(BaseModel):
    notes: Optional[str] = None


class BudgetClosure(BaseModel):
    reason: str = Field(..., min_length=3)
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InvoiceCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=200)
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None

    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="GHS", min_length=3, max_length=3)

    issue_date: date
    due_date: date

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = Field(
        None,
        min_length=2,
        max_length=200,
    )
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None

    title: Optional[str] = Field(
        None,
        min_length=3,
        max_length=200,
    )
    description: Optional[str] = None

    amount: Optional[Decimal] = Field(
        None,
        gt=0,
    )
    currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
    )

    issue_date: Optional[date] = None
    due_date: Optional[date] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_number: str

    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None

    title: str
    description: Optional[str] = None

    amount: Decimal
    amount_paid: Decimal
    currency: str

    issue_date: date
    due_date: date

    status: str

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    notes: Optional[str] = None

    issued_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    cancellation_reason: Optional[str] = None

    created_by_id: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class InvoiceCancellation(BaseModel):
    cancellation_reason: str = Field(
        ...,
        min_length=3,
    )
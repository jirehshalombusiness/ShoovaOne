from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="GHS", min_length=3, max_length=3)
    payment_date: date
    payment_method: str = Field(..., min_length=2, max_length=50)
    reference: Optional[str] = Field(default=None, max_length=200)
    payer_name: Optional[str] = Field(default=None, max_length=200)
    payer_email: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    payment_date: Optional[date] = None
    payment_method: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=50,
    )
    reference: Optional[str] = Field(
        default=None,
        max_length=200,
    )
    payer_name: Optional[str] = Field(
        default=None,
        max_length=200,
    )
    payer_email: Optional[str] = Field(
        default=None,
        max_length=255,
    )
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: str
    payment_number: str
    invoice_id: str
    amount: Decimal
    currency: str
    payment_date: date
    payment_method: str
    reference: Optional[str] = None
    payer_name: Optional[str] = None
    payer_email: Optional[str] = None
    notes: Optional[str] = None
    status: str
    recorded_by_id: Optional[str] = None
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime


class PaymentCancellation(BaseModel):
    reason: str = Field(..., min_length=3)
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ReimbursementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None

    category: str = Field(
        ...,
        min_length=2,
        max_length=100,
    )

    amount: Decimal = Field(..., gt=0)

    currency: str = Field(
        default="GHS",
        min_length=3,
        max_length=3,
    )

    incurred_date: date

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    payment_method: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_reference: Optional[str] = None


class ReimbursementUpdate(BaseModel):
    title: Optional[str] = Field(
        None,
        min_length=3,
        max_length=200,
    )

    description: Optional[str] = None

    category: Optional[str] = Field(
        None,
        min_length=2,
        max_length=100,
    )

    amount: Optional[Decimal] = Field(
        None,
        gt=0,
    )

    currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
    )

    incurred_date: Optional[date] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    payment_method: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_reference: Optional[str] = None


class ReimbursementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reimbursement_number: str

    title: str
    description: Optional[str] = None
    category: str

    amount: Decimal
    currency: str
    incurred_date: date

    requester_id: str

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    payment_method: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_reference: Optional[str] = None

    status: str

    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    reconciled_at: Optional[datetime] = None

    reviewer_id: Optional[str] = None
    approver_id: Optional[str] = None
    payer_id: Optional[str] = None
    reconciler_id: Optional[str] = None

    review_notes: Optional[str] = None
    approval_notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    payment_notes: Optional[str] = None
    reconciliation_notes: Optional[str] = None


class ReimbursementReview(BaseModel):
    review_notes: Optional[str] = None


class ReimbursementApproval(BaseModel):
    approval_notes: Optional[str] = None


class ReimbursementRejection(BaseModel):
    rejection_reason: str = Field(
        ...,
        min_length=3,
    )


class ReimbursementPayment(BaseModel):
    payment_notes: Optional[str] = None


class ReimbursementReconciliation(BaseModel):
    reconciliation_notes: Optional[str] = None
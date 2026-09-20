from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class FundRequestCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    justification: Optional[str] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Decimal = Field(..., gt=0)
    currency: str = Field(default="GHS", min_length=3, max_length=3)

    required_by_date: Optional[date] = None


class FundRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    justification: Optional[str] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Optional[Decimal] = Field(None, gt=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)

    required_by_date: Optional[date] = None


class FundRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_number: str

    title: str
    description: Optional[str] = None
    justification: Optional[str] = None

    requester_id: str
    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Decimal
    currency: str
    approved_amount: Optional[Decimal] = None
    amount_disbursed: Decimal

    status: str

    required_by_date: Optional[date] = None

    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None
    reconciled_at: Optional[datetime] = None

    reviewer_id: Optional[str] = None
    approver_id: Optional[str] = None
    disburser_id: Optional[str] = None
    reconciler_id: Optional[str] = None

    rejection_reason: Optional[str] = None
    review_notes: Optional[str] = None
    approval_notes: Optional[str] = None
    disbursement_notes: Optional[str] = None
    reconciliation_notes: Optional[str] = None

    created_at: datetime
    updated_at: datetime

class FundRequestReview(BaseModel):
    review_notes: Optional[str] = None


class FundRequestApproval(BaseModel):
    approved_amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )
    approval_notes: Optional[str] = None


class FundRequestRejection(BaseModel):
    rejection_reason: str = Field(
        ...,
        min_length=3,
    )


class FundRequestDisbursement(BaseModel):
    amount_disbursed: Decimal = Field(
        ...,
        gt=0,
    )
    disbursement_notes: Optional[str] = None


class FundRequestReconciliation(BaseModel):
    reconciliation_notes: Optional[str] = None    

class FinanceOverviewResponse(BaseModel):
    total_fund_requests: int
    pending_fund_requests: int
    approved_fund_requests: int
    total_funds_requested: Decimal
    total_funds_approved: Decimal
    total_funds_disbursed: Decimal

    total_expenses: int
    pending_expenses: int
    approved_expenses: int
    total_expense_amount: Decimal
    total_paid_expenses: Decimal

    expenses_requiring_reconciliation: int
    fund_requests_requiring_reconciliation: int    
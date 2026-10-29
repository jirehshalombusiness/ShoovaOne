from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


FundRequestType = Literal["advance", "reimbursement"]


class FundRequestCreate(BaseModel):
    request_type: FundRequestType = "reimbursement"

    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    justification: Optional[str] = None

    expense_date: Optional[date] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Decimal = Field(..., gt=0)
    currency: str = Field(
        default="GHS",
        min_length=3,
        max_length=3,
    )

    required_by_date: Optional[date] = None

    @model_validator(mode="after")
    def _validate_reimbursement(self):
        if self.request_type == "reimbursement" and self.expense_date is None:
            raise ValueError(
                "A reimbursement must record the date the money was spent."
            )
        return self


class FundRequestUpdate(BaseModel):
    request_type: Optional[FundRequestType] = None

    title: Optional[str] = Field(
        None,
        min_length=3,
        max_length=200,
    )
    description: Optional[str] = None
    justification: Optional[str] = None

    expense_date: Optional[date] = None

    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Optional[Decimal] = Field(
        None,
        gt=0,
    )

    currency: Optional[str] = Field(
        None,
        min_length=3,
        max_length=3,
    )

    required_by_date: Optional[date] = None


class FundRequestDocument(BaseModel):
    id: str
    name: str
    file_url: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    category: Optional[str] = None
    uploaded_by_id: Optional[str] = None
    created_at: Optional[datetime] = None


class FundRequestApprovalRecord(BaseModel):
    id: str
    stage: str
    decision: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    note: Optional[str] = None
    decided_at: Optional[datetime] = None


class FundRequestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    request_number: str

    request_type: str
    expense_date: Optional[date] = None

    title: str
    description: Optional[str] = None
    justification: Optional[str] = None

    requester_id: str
    requester_name: Optional[str] = None
    project_id: Optional[str] = None
    programme_id: Optional[str] = None
    department_id: Optional[str] = None

    amount_requested: Decimal
    currency: str
    approved_amount: Optional[Decimal] = None
    amount_disbursed: Decimal

    status: str
    current_stage: Optional[str] = None

    required_by_date: Optional[date] = None

    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    disbursed_at: Optional[datetime] = None

    manager_decided_by_id: Optional[str] = None
    manager_decided_at: Optional[datetime] = None
    manager_decision_note: Optional[str] = None

    finance_decided_by_id: Optional[str] = None
    finance_decided_at: Optional[datetime] = None
    finance_decision_note: Optional[str] = None

    ceo_decided_by_id: Optional[str] = None
    ceo_decided_at: Optional[datetime] = None
    ceo_decision_note: Optional[str] = None

    disburser_id: Optional[str] = None
    disbursement_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

    receipt_required: bool = True
    receipt_reference: Optional[str] = None
    receipt_verified_by_id: Optional[str] = None
    receipt_verified_at: Optional[datetime] = None
    receipt_verification_note: Optional[str] = None

    approval_id: Optional[str] = None

    created_at: datetime
    updated_at: datetime


class FundRequestDetailResponse(FundRequestResponse):
    documents: list[FundRequestDocument] = Field(default_factory=list)
    approvals: list[FundRequestApprovalRecord] = Field(default_factory=list)
    next_approver_name: Optional[str] = None


class FundRequestDecisionRequest(BaseModel):
    note: Optional[str] = None
    approved_amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
    )


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


class FundRequestReceiptVerification(BaseModel):
    verified: bool
    note: Optional[str] = None
    receipt_reference: Optional[str] = Field(
        default=None,
        max_length=120,
    )


class FinanceCurrencyTotals(BaseModel):
    requested: Decimal
    approved: Decimal
    disbursed: Decimal


class FinanceReportingTotals(BaseModel):
    currency: str
    requested: Decimal
    approved: Decimal
    disbursed: Decimal


class FinanceOverviewResponse(BaseModel):
    total_fund_requests: int
    pending_fund_requests: int
    approved_fund_requests: int
    disbursed_fund_requests: int

    fund_totals_by_currency: dict[str, FinanceCurrencyTotals]

    reporting_totals: FinanceReportingTotals

    total_expenses: int
    pending_expenses: int
    approved_expenses: int
    total_expense_amount: Decimal
    total_paid_expenses: Decimal

    expenses_requiring_reconciliation: int
    fund_requests_requiring_reconciliation: int
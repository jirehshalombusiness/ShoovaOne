from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================
# CONFIGURATION
# ============================================================

class PayPeriodCreate(BaseModel):
    name: str
    frequency: str
    period_start: date
    period_end: date
    cutoff_at: Optional[datetime] = None
    pay_date: date
    notes: Optional[str] = None


class PayPeriodGenerate(BaseModel):
    frequency: Literal["weekly", "biweekly", "semi_monthly", "monthly"]
    start_date: date
    end_date: date
    pay_day_offset: int = Field(default=0, ge=0, le=60)
    cutoff_days_before_end: int = Field(default=0, ge=0, le=30)


class PayPeriodUpdate(BaseModel):
    name: Optional[str] = None
    cutoff_at: Optional[datetime] = None
    pay_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class PayPeriodResponse(ORMBase):
    id: str
    name: str
    frequency: str
    period_start: date
    period_end: date
    cutoff_at: Optional[datetime] = None
    pay_date: date
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PayGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    pay_type: str = "salaried"
    currency: str = "GHS"
    overtime_eligible: bool = False
    proration_basis: str = "working_days"
    is_active: bool = True


class PayGroupUpdate(BaseModel):
    description: Optional[str] = None
    pay_type: Optional[str] = None
    currency: Optional[str] = None
    overtime_eligible: Optional[bool] = None
    proration_basis: Optional[str] = None
    is_active: Optional[bool] = None


class PayGroupResponse(ORMBase):
    id: str
    name: str
    description: Optional[str] = None
    pay_type: str
    currency: str
    overtime_eligible: bool
    proration_basis: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TaxBandCreate(BaseModel):
    sequence: int = 1
    band_from: Decimal = Decimal("0")
    band_to: Optional[Decimal] = None
    rate: Decimal = Decimal("0")


class TaxBandResponse(ORMBase):
    id: str
    sequence: int
    band_from: Decimal
    band_to: Optional[Decimal] = None
    rate: Decimal


class StatutorySchemeCreate(BaseModel):
    name: str
    code: str
    jurisdiction: str = "GH"
    scheme_type: str = "social_security"
    employee_rate: Decimal = Decimal("0")
    employer_rate: Decimal = Decimal("0")
    base: str = "basic"
    cap: Optional[Decimal] = None
    relief_amount: Decimal = Decimal("0")
    remittance_due_day: Optional[int] = None
    priority: int = 100
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None
    bands: List[TaxBandCreate] = Field(default_factory=list)


class StatutorySchemeResponse(ORMBase):
    id: str
    name: str
    code: str
    jurisdiction: str
    scheme_type: str
    employee_rate: Decimal
    employer_rate: Decimal
    base: str
    cap: Optional[Decimal] = None
    relief_amount: Decimal
    remittance_due_day: Optional[int] = None
    priority: int
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool
    notes: Optional[str] = None
    bands: List[TaxBandResponse] = Field(default_factory=list)


class StatutorySchemeUpdate(BaseModel):
    name: Optional[str] = None
    remittance_due_day: Optional[int] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ComponentTypeCreate(BaseModel):
    code: str
    name: str
    category: str
    taxable: bool = True
    statutory: bool = False
    calculation: str = "fixed"
    default_amount: Decimal = Decimal("0")
    default_rate: Decimal = Decimal("0")
    calculation_base: str = "gross"
    priority: int = 100
    gl_account: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None


class ComponentTypeResponse(ORMBase):
    id: str
    code: str
    name: str
    category: str
    taxable: bool
    statutory: bool
    calculation: str
    default_amount: Decimal
    default_rate: Decimal
    calculation_base: str
    priority: int
    gl_account: Optional[str] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ComponentTypeUpdate(BaseModel):
    name: Optional[str] = None
    taxable: Optional[bool] = None
    statutory: Optional[bool] = None
    calculation: Optional[str] = None
    default_amount: Optional[Decimal] = None
    default_rate: Optional[Decimal] = None
    calculation_base: Optional[str] = None
    priority: Optional[int] = None
    gl_account: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ============================================================
# EMPLOYEE PAY SETUP
# ============================================================

class PayProfileUpsert(BaseModel):
    person_id: str
    pay_group_id: Optional[str] = None
    pay_type: str = "salaried"
    base_amount: Decimal = Decimal("0")
    hourly_rate: Decimal = Decimal("0")
    currency: str = "GHS"
    overtime_multiplier: Decimal = Decimal("1.5")
    payment_method: str = "bank_transfer"
    cost_center: Optional[str] = None
    department: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool = True
    notes: Optional[str] = None


class PayProfileResponse(ORMBase):
    id: str
    person_id: str
    person_name: Optional[str] = None
    pay_group_id: Optional[str] = None
    pay_type: str
    base_amount: Decimal
    hourly_rate: Decimal
    currency: str
    overtime_multiplier: Decimal
    payment_method: str
    cost_center: Optional[str] = None
    department: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BankAccountCreate(BaseModel):
    bank_name: str
    branch: Optional[str] = None
    bank_code: Optional[str] = None
    account_name: str
    account_number: str
    mobile_money_provider: Optional[str] = None
    is_primary: bool = False
    effective_from: date
    effective_to: Optional[date] = None


class BankAccountResponse(ORMBase):
    id: str
    person_id: str
    bank_name: str
    branch: Optional[str] = None
    bank_code: Optional[str] = None
    account_name: str
    account_number_last4: str
    mobile_money_provider: Optional[str] = None
    is_primary: bool
    verification_status: str
    verification_note: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime


class BankAccountApprove(BaseModel):
    note: Optional[str] = None


class BankAccountReject(BaseModel):
    reason: str


class RecurringComponentCreate(BaseModel):
    component_type_id: str
    amount: Decimal = Decimal("0")
    rate: Decimal = Decimal("0")
    effective_from: date
    effective_to: Optional[date] = None
    remaining_amount: Optional[Decimal] = None
    is_active: bool = True
    notes: Optional[str] = None


class RecurringComponentResponse(ORMBase):
    id: str
    person_id: str
    component_type_id: str
    component_code: Optional[str] = None
    component_name: Optional[str] = None
    component_category: Optional[str] = None
    amount: Decimal
    rate: Decimal
    effective_from: date
    effective_to: Optional[date] = None
    remaining_amount: Optional[Decimal] = None
    is_active: bool
    notes: Optional[str] = None
    created_at: datetime


class LoanCreate(BaseModel):
    principal: Decimal
    interest_rate: Decimal = Decimal("0")
    installment_amount: Decimal
    term_months: int = Field(gt=0)
    start_date: date
    notes: Optional[str] = None


class LoanInstallmentResponse(ORMBase):
    id: str
    sequence: int
    due_date: date
    amount: Decimal
    principal_portion: Decimal
    interest_portion: Decimal
    status: str
    paid_at: Optional[datetime] = None


class LoanResponse(ORMBase):
    id: str
    person_id: str
    principal: Decimal
    interest_rate: Decimal
    installment_amount: Decimal
    term_months: int
    start_date: date
    outstanding_balance: Decimal
    status: str
    approved_by_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    installments: List[LoanInstallmentResponse] = Field(default_factory=list)


class LoanApprove(BaseModel):
    note: Optional[str] = None


# ============================================================
# PAY RUNS
# ============================================================

class PayRunCreate(BaseModel):
    period_id: str
    pay_group_id: str
    run_type: str = "regular"
    notes: Optional[str] = None


class PayRunLineResponse(ORMBase):
    id: str
    code: str
    name: str
    category: str
    quantity: Optional[Decimal] = None
    rate: Optional[Decimal] = None
    amount: Decimal
    taxable: str
    statutory: str
    employer: str
    source: str
    source_ref: Optional[str] = None
    priority: int
    notes: Optional[str] = None


class PayRunItemResponse(ORMBase):
    id: str
    person_id: str
    person_name: str
    employee_number: Optional[str] = None
    department: Optional[str] = None
    cost_center: Optional[str] = None
    pay_type: str
    currency: str
    regular_hours: Decimal
    overtime_hours: Decimal
    unpaid_leave_days: Decimal
    gross_pay: Decimal
    total_employee_deductions: Decimal
    total_employer_contributions: Decimal
    net_pay: Decimal
    employer_cost: Decimal
    status: str
    exception_summary: Optional[str] = None
    lines: List[PayRunLineResponse] = Field(default_factory=list)


class PayRunApprovalResponse(ORMBase):
    id: str
    stage: str
    decision: str
    actor_person_id: Optional[str] = None
    note: Optional[str] = None
    decided_at: datetime


class PayRunResponse(ORMBase):
    id: str
    run_number: Optional[str] = None
    period_id: str
    pay_group_id: str
    period_name: Optional[str] = None
    pay_group_name: Optional[str] = None
    run_type: str
    status: str
    currency: str
    total_gross: Decimal
    total_employee_deductions: Decimal
    total_employer_contributions: Decimal
    total_net: Decimal
    total_employer_cost: Decimal
    employee_count: int
    exception_count: int
    prepared_by_id: Optional[str] = None
    hr_approved_by_id: Optional[str] = None
    hr_approved_at: Optional[datetime] = None
    finance_approved_by_id: Optional[str] = None
    finance_approved_at: Optional[datetime] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    finalized_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PayRunDetailResponse(PayRunResponse):
    items: List[PayRunItemResponse] = Field(default_factory=list)
    approvals: List[PayRunApprovalResponse] = Field(default_factory=list)


class PayRunReviewDecision(BaseModel):
    decision: Literal["approved", "returned"]
    note: Optional[str] = None


class PayRunDecision(BaseModel):
    note: Optional[str] = None


class PayRunSubmit(BaseModel):
    note: Optional[str] = None


class PayslipResponse(ORMBase):
    id: str
    run_item_id: str
    person_id: str
    period_id: str
    period_name: Optional[str] = None
    gross_pay: Decimal
    total_deductions: Decimal
    net_pay: Decimal
    ytd_gross: Decimal
    ytd_deductions: Decimal
    ytd_net: Decimal
    status: str
    version: int
    issued_at: datetime
    viewed_at: Optional[datetime] = None
    lines: List[PayRunLineResponse] = Field(default_factory=list)


class RemittanceResponse(ORMBase):
    id: str
    scheme_id: str
    scheme_name: str
    employee_amount: Decimal
    employer_amount: Decimal
    total_amount: Decimal
    due_date: Optional[date] = None
    status: str
    paid_at: Optional[datetime] = None
    reference: Optional[str] = None


class RemittancePayRequest(BaseModel):
    reference: str = Field(min_length=1, max_length=200)


class GLEntryResponse(ORMBase):
    id: str
    entry_date: date
    account_code: str
    account_name: str
    description: Optional[str] = None
    cost_center: Optional[str] = None
    debit: Decimal
    credit: Decimal
    status: str


# ============================================================
# DISBURSEMENT
# ============================================================

class DisbursementBatchCreate(BaseModel):
    run_id: str
    method: str = "bank_transfer"
    pay_date: Optional[date] = None
    notes: Optional[str] = None


class DisbursementItemResponse(ORMBase):
    id: str
    person_id: str
    person_name: str
    employee_number: Optional[str] = None
    amount: Decimal
    method: str
    destination_masked: Optional[str] = None
    status: str
    failure_reason: Optional[str] = None
    retry_count: int
    provider_reference: Optional[str] = None
    paid_at: Optional[datetime] = None


class DisbursementBatchResponse(ORMBase):
    id: str
    batch_number: str
    run_id: str
    method: str
    currency: str
    pay_date: date
    status: str
    control_count: int
    control_total: Decimal
    bank_file_reference: Optional[str] = None
    bank_file_hash: Optional[str] = None
    provider_reference: Optional[str] = None
    created_by_id: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    items: List[DisbursementItemResponse] = Field(default_factory=list)


class DisbursementDecision(BaseModel):
    note: Optional[str] = None


class ReconcileItemRequest(BaseModel):
    status: Literal["paid", "failed"]
    failure_reason: Optional[str] = None
    provider_reference: Optional[str] = None


class ReconcileBatchRequest(BaseModel):
    outcome: Literal["paid", "failed"]
    failure_reason: Optional[str] = None
    provider_reference: Optional[str] = None


class RetryItemRequest(BaseModel):
    provider_reference: Optional[str] = None

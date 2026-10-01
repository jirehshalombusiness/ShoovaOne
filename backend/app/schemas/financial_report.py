from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class FinancialReportPeriod(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class FinancialSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    period: FinancialReportPeriod

    total_budget: Decimal
    total_funds_requested: Decimal
    total_funds_approved: Decimal
    total_funds_disbursed: Decimal

    total_expenses: Decimal
    total_paid_expenses: Decimal

    total_reimbursements: Decimal
    total_paid_reimbursements: Decimal

    total_expenditure: Decimal

    total_invoiced: Decimal
    total_received: Decimal
    outstanding_receivables: Decimal


class BudgetVsActualItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    budget_id: str
    budget_number: str
    name: str
    fiscal_year: str
    currency: str

    budget_amount: Decimal
    spent: Decimal
    remaining: Decimal
    utilisation_percentage: Decimal

    status: str

    department_id: Optional[str] = None
    programme_id: Optional[str] = None
    project_id: Optional[str] = None


class IncomeExpenditureResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    period: FinancialReportPeriod

    income: Decimal
    expenses: Decimal
    reimbursements: Decimal

    total_expenditure: Decimal
    net_cash_flow: Decimal


class ReceivableItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invoice_id: str
    invoice_number: str

    customer_name: str
    customer_email: Optional[str] = None

    currency: str

    issue_date: date
    due_date: date

    amount: Decimal
    amount_paid: Decimal
    outstanding: Decimal

    status: str
    overdue: bool


class FundFlowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    currency: str
    period: FinancialReportPeriod

    inflow: Decimal

    fund_disbursements: Decimal
    expense_outflow: Decimal
    reimbursement_outflow: Decimal

    total_outflow: Decimal
    net_flow: Decimal


class CurrencySummaryItem(BaseModel):
    currency: str


class CurrencySummaryResponse(BaseModel):
    currencies: list[CurrencySummaryItem]
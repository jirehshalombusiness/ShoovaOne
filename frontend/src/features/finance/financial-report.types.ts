export interface FinancialReportPeriod {
  start_date?: string | null;
  end_date?: string | null;
}

export interface FinancialSummary {
  currency: string;
  period: FinancialReportPeriod;

  total_budget: number;
  total_funds_requested: number;
  total_funds_approved: number;
  total_funds_disbursed: number;

  total_expenses: number;
  total_paid_expenses: number;

  total_reimbursements: number;
  total_paid_reimbursements: number;

  total_expenditure: number;

  total_invoiced: number;
  total_received: number;
  outstanding_receivables: number;
}

export interface BudgetVsActualItem {
  budget_id: string;
  budget_number: string;
  name: string;
  fiscal_year: string;
  currency: string;

  budget_amount: number;
  spent: number;
  remaining: number;
  utilisation_percentage: number;

  status: string;

  department_id?: string | null;
  programme_id?: string | null;
  project_id?: string | null;
}

export interface IncomeExpenditureReport {
  currency: string;
  period: FinancialReportPeriod;

  income: number;
  expenses: number;
  reimbursements: number;
  total_expenditure: number;
  net_cash_flow: number;
}

export interface ReceivableItem {
  invoice_id: string;
  invoice_number: string;

  customer_name: string;
  customer_email?: string | null;

  currency: string;

  issue_date: string;
  due_date: string;

  amount: number;
  amount_paid: number;
  outstanding: number;

  status: string;
  overdue: boolean;
}

export interface FundFlowReport {
  currency: string;
  period: FinancialReportPeriod;

  inflow: number;

  fund_disbursements: number;
  expense_outflow: number;
  reimbursement_outflow: number;

  total_outflow: number;
  net_flow: number;
}

export interface CurrencySummaryItem {
  currency: string;
}

export interface CurrencySummaryResponse {
  currencies: CurrencySummaryItem[];
}

export interface FinancialReportFilters {
  currency?: string;
  start_date?: string;
  end_date?: string;
  fiscal_year?: string;
  include_paid?: boolean;
}
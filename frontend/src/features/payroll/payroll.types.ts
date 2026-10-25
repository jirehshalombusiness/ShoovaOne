export type Money = string | number;

export interface PayPeriod {
  id: string;
  name: string;
  frequency: string;
  period_start: string;
  period_end: string;
  cutoff_at: string | null;
  pay_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayGroup {
  id: string;
  name: string;
  description: string | null;
  pay_type: string;
  currency: string;
  overtime_eligible: boolean;
  proration_basis: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxBand {
  id?: string;
  sequence: number;
  band_from: Money;
  band_to: Money | null;
  rate: Money;
}

export interface StatutoryScheme {
  id: string;
  name: string;
  code: string;
  jurisdiction: string;
  scheme_type: string;
  employee_rate: Money;
  employer_rate: Money;
  base: string;
  cap: Money | null;
  relief_amount: Money;
  remittance_due_day: number | null;
  priority: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  bands: TaxBand[];
}

export interface ComponentType {
  id: string;
  code: string;
  name: string;
  category: string;
  taxable: boolean;
  statutory: boolean;
  calculation: string;
  default_amount: Money;
  default_rate: Money;
  calculation_base: string;
  priority: number;
  gl_account: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayProfile {
  id: string;
  person_id: string;
  person_name: string | null;
  pay_group_id: string | null;
  pay_type: string;
  base_amount: Money;
  hourly_rate: Money;
  currency: string;
  overtime_multiplier: Money;
  payment_method: string;
  cost_center: string | null;
  department: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeBankAccount {
  id: string;
  person_id: string;
  bank_name: string;
  branch: string | null;
  bank_code: string | null;
  account_name: string;
  account_number_last4: string;
  mobile_money_provider: string | null;
  is_primary: boolean;
  verification_status: string;
  verification_note: string | null;
  effective_from: string;
  effective_to: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface RecurringComponent {
  id: string;
  person_id: string;
  component_type_id: string;
  component_code: string | null;
  component_name: string | null;
  component_category: string | null;
  amount: Money;
  rate: Money;
  effective_from: string;
  effective_to: string | null;
  remaining_amount: Money | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface LoanInstallment {
  id: string;
  sequence: number;
  due_date: string;
  amount: Money;
  principal_portion: Money;
  interest_portion: Money;
  status: string;
  paid_at: string | null;
}

export interface Loan {
  id: string;
  person_id: string;
  principal: Money;
  interest_rate: Money;
  installment_amount: Money;
  term_months: number;
  start_date: string;
  outstanding_balance: Money;
  status: string;
  approved_by_id: string | null;
  notes: string | null;
  created_at: string;
  installments: LoanInstallment[];
}

export interface PayRunLine {
  id: string;
  code: string;
  name: string;
  category: string;
  quantity: Money | null;
  rate: Money | null;
  amount: Money;
  taxable: string;
  statutory: string;
  employer: string;
  source: string;
  source_ref: string | null;
  priority: number;
  notes: string | null;
}

export interface PayRunItem {
  id: string;
  person_id: string;
  person_name: string;
  employee_number: string | null;
  department: string | null;
  cost_center: string | null;
  pay_type: string;
  currency: string;
  regular_hours: Money;
  overtime_hours: Money;
  unpaid_leave_days: Money;
  gross_pay: Money;
  total_employee_deductions: Money;
  total_employer_contributions: Money;
  net_pay: Money;
  employer_cost: Money;
  status: string;
  exception_summary: string | null;
  lines: PayRunLine[];
}

export interface PayRunApproval {
  id: string;
  stage: string;
  decision: string;
  actor_person_id: string | null;
  note: string | null;
  decided_at: string;
}

export interface PayRun {
  id: string;
  run_number: string | null;
  period_id: string;
  pay_group_id: string;
  period_name: string | null;
  pay_group_name: string | null;
  run_type: string;
  status: string;
  currency: string;
  total_gross: Money;
  total_employee_deductions: Money;
  total_employer_contributions: Money;
  total_net: Money;
  total_employer_cost: Money;
  employee_count: number;
  exception_count: number;
  prepared_by_id: string | null;
  hr_approved_by_id: string | null;
  hr_approved_at: string | null;
  finance_approved_by_id: string | null;
  finance_approved_at: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  finalized_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  approvals: PayRunApproval[];
}

export interface PayRunDetail extends PayRun {
  items: PayRunItem[];
}

export interface Payslip {
  id: string;
  run_item_id: string;
  person_id: string;
  period_id: string;
  period_name: string | null;
  gross_pay: Money;
  total_deductions: Money;
  net_pay: Money;
  ytd_gross: Money;
  ytd_deductions: Money;
  ytd_net: Money;
  status: string;
  version: number;
  issued_at: string;
  viewed_at: string | null;
  lines: PayRunLine[];
}

export interface Remittance {
  id: string;
  scheme_id: string;
  scheme_name: string;
  employee_amount: Money;
  employer_amount: Money;
  total_amount: Money;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  reference: string | null;
}

export interface GLEntry {
  id: string;
  entry_date: string;
  account_code: string;
  account_name: string;
  description: string | null;
  cost_center: string | null;
  debit: Money;
  credit: Money;
  status: string;
}

export interface DisbursementItem {
  id: string;
  person_id: string;
  person_name: string;
  employee_number: string | null;
  amount: Money;
  method: string;
  destination_masked: string | null;
  status: string;
  failure_reason: string | null;
  retry_count: number;
  provider_reference: string | null;
  paid_at: string | null;
}

export interface DisbursementBatch {
  id: string;
  batch_number: string;
  run_id: string;
  method: string;
  currency: string;
  pay_date: string;
  status: string;
  control_count: number;
  control_total: Money;
  bank_file_reference: string | null;
  bank_file_hash: string | null;
  provider_reference: string | null;
  created_by_id: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  items: DisbursementItem[];
}

export interface PayrollOverview {
  run_counts: Record<string, number>;
  pending_remittances: {
    count: number;
    total: Money;
  };
  active_loans: {
    count: number;
    outstanding_balance: Money;
  };
}

export interface PayrollSummaryReport {
  from_date: string;
  to_date: string;
  totals: {
    gross: Money;
    employee_deductions: Money;
    employer_contributions: Money;
    net: Money;
    employer_cost: Money;
    employee_count: number;
  };
  by_period: {
    period_name: string;
    pay_date: string | null;
    gross: Money;
    net: Money;
    employer_cost: Money;
    employee_count: number;
  }[];
  runs: PayRun[];
}

export interface StatutoryReport {
  total_employee: Money;
  total_employer: Money;
  total: Money;
  by_scheme: {
    scheme_code: string;
    scheme_name: string;
    employee_amount: Money;
    employer_amount: Money;
    total_amount: Money;
  }[];
  remittances: {
    id: string;
    run_id: string;
    scheme_name: string;
    employee_amount: Money;
    employer_amount: Money;
    total_amount: Money;
    due_date: string | null;
    status: string;
    paid_at: string | null;
    reference: string | null;
  }[];
}

export interface DepartmentCostReport {
  run_id: string;
  period_name: string | null;
  currency: string;
  rows: {
    department: string;
    cost_center: string;
    employee_count: number;
    gross: Money;
    employer_contributions: Money;
    net: Money;
    employer_cost: Money;
  }[];
}

export interface MyPayProfile {
  person_id: string;
  pay_group_id: string | null;
  pay_type: string;
  base_amount: Money;
  hourly_rate: Money;
  currency: string;
  overtime_multiplier: Money;
  payment_method: string;
  department: string | null;
  effective_from: string;
  effective_to: string | null;
  bank_accounts: {
    id: string;
    bank_name: string;
    account_name: string;
    account_number_last4: string;
    mobile_money_provider: string | null;
    is_primary: boolean;
    verification_status: string;
    effective_from: string;
    effective_to: string | null;
  }[];
  recurring_components: {
    id: string;
    code: string | null;
    name: string | null;
    category: string | null;
    amount: Money;
    rate: Money;
    remaining_amount: Money | null;
    effective_from: string;
    effective_to: string | null;
  }[];
  loans: {
    id: string;
    principal: Money;
    installment_amount: Money;
    outstanding_balance: Money;
    term_months: number;
    start_date: string;
  }[];
}

export interface FinanceCurrencyTotals {
  requested: number;
  approved: number;
  disbursed: number;
}

export interface FinanceReportingTotals {
  currency: string;
  requested: number;
  approved: number;
  disbursed: number;
}

export interface FinanceOverview {
  total_fund_requests: number;

  pending_fund_requests: number;

  approved_fund_requests: number;

  disbursed_fund_requests: number;

  fund_totals_by_currency: Record<
    string,
    FinanceCurrencyTotals
  >;

  reporting_totals: FinanceReportingTotals;

  total_expenses: number;

  pending_expenses: number;

  approved_expenses: number;

  total_expense_amount: number;

  total_paid_expenses: number;

  expenses_requiring_reconciliation: number;

  fund_requests_requiring_reconciliation: number;
}

export type FundRequestType = 'advance' | 'reimbursement';

export type FundRequestStatus =
  | 'draft'
  | 'submitted'
  | 'manager_approved'
  | 'finance_approved'
  | 'approved'
  | 'disbursed'
  | 'verified'
  | 'verification_failed'
  | 'rejected'
  | 'cancelled';

export type FundRequestStage =
  | 'manager'
  | 'finance'
  | 'ceo'
  | 'disbursement'
  | 'verification'
  | 'closed';

export interface FundRequest {
  id: string;

  request_number: string;

  request_type: FundRequestType;

  expense_date?: string | null;

  title: string;

  description?: string | null;

  justification?: string | null;

  requester_id: string;

  requester_name?: string | null;

  project_id?: string | null;

  programme_id?: string | null;

  department_id?: string | null;

  amount_requested: number;

  currency: string;

  approved_amount?: number | null;

  amount_disbursed: number;

  status: FundRequestStatus;

  current_stage?: FundRequestStage | null;

  required_by_date?: string | null;

  submitted_at?: string | null;

  approved_at?: string | null;

  disbursed_at?: string | null;

  manager_decided_by_id?: string | null;
  manager_decided_at?: string | null;
  manager_decision_note?: string | null;

  finance_decided_by_id?: string | null;
  finance_decided_at?: string | null;
  finance_decision_note?: string | null;

  ceo_decided_by_id?: string | null;
  ceo_decided_at?: string | null;
  ceo_decision_note?: string | null;

  disburser_id?: string | null;
  disbursement_notes?: string | null;

  rejection_reason?: string | null;

  receipt_required: boolean;
  receipt_reference?: string | null;
  receipt_verified_by_id?: string | null;
  receipt_verified_at?: string | null;
  receipt_verification_note?: string | null;

  approval_id?: string | null;

  created_at: string;
  updated_at: string;
}

export interface FundRequestDocument {
  id: string;
  name: string;
  file_url: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  category?: string | null;
  uploaded_by_id?: string | null;
  created_at?: string | null;
}

export interface FundRequestApprovalRecord {
  id: string;
  stage: FundRequestStage;
  decision: string;
  actor_id?: string | null;
  actor_name?: string | null;
  note?: string | null;
  decided_at?: string | null;
}

export interface FundRequestDetail extends FundRequest {
  documents: FundRequestDocument[];
  approvals: FundRequestApprovalRecord[];
  next_approver_name?: string | null;
}

export interface FundRequestListParams {
  status?: FundRequestStatus;

  stage?: FundRequestStage;

  request_type?: FundRequestType;

  requester_id?: string;

  search?: string;

  limit?: number;

  offset?: number;
}

export interface FundRequestReceiptVerificationPayload {
  verified: boolean;
  note?: string;
  receipt_reference?: string;
}

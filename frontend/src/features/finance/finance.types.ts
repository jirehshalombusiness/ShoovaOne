export interface FinanceOverview {
  total_fund_requests: number;
  pending_fund_requests: number;
  approved_fund_requests: number;

  total_funds_requested: number;
  total_funds_approved: number;
  total_funds_disbursed: number;

  total_expenses: number;
  pending_expenses: number;
  approved_expenses: number;

  total_expense_amount: number;
  total_paid_expenses: number;

  expenses_requiring_reconciliation: number;
  fund_requests_requiring_reconciliation: number;
}

export type FundRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'reconciled';

export interface FundRequest {
  id: string;
  request_number: string;
  title: string;
  description?: string | null;
  justification?: string | null;

  requester_id: string;

  project_id?: string | null;
  programme_id?: string | null;
  department_id?: string | null;

  amount_requested: number;
  currency: string;

  approved_amount?: number | null;
  amount_disbursed: number;

  status: FundRequestStatus;

  required_by_date?: string | null;

  submitted_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  disbursed_at?: string | null;
  reconciled_at?: string | null;

  reviewer_id?: string | null;
  approver_id?: string | null;
  disburser_id?: string | null;
  reconciler_id?: string | null;

  rejection_reason?: string | null;
  review_notes?: string | null;
  approval_notes?: string | null;
  disbursement_notes?: string | null;
  reconciliation_notes?: string | null;

  created_at: string;
  updated_at: string;
}

export interface FundRequestListParams {
  status?: FundRequestStatus;
  search?: string;
  page?: number;
  page_size?: number;
}
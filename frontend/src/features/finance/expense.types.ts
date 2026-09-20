export type ExpenseStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'reconciled';

export interface Expense {
  id: string;
  expense_number: string;

  title: string;
  description?: string | null;
  category?: string | null;

  amount: number;
  currency: string;

  incurred_date: string;

  requester_id: string;
  project_id?: string | null;
  programme_id?: string | null;
  department_id?: string | null;

  vendor_name?: string | null;
  reference?: string | null;
  payment_method?: string | null;

  status: ExpenseStatus;

  submitted_at?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  reconciled_at?: string | null;

  reviewer_id?: string | null;
  approver_id?: string | null;
  payer_id?: string | null;
  reconciler_id?: string | null;

  review_notes?: string | null;
  approval_notes?: string | null;
  rejection_reason?: string | null;
  payment_notes?: string | null;
  reconciliation_notes?: string | null;

  created_at: string;
  updated_at: string;
}

export interface ExpenseListParams {
  status?: ExpenseStatus;
  category?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CreateExpensePayload {
  title: string;
  description?: string;
  category?: string;

  amount: number;
  currency: string;

  incurred_date: string;

  project_id?: string;
  programme_id?: string;
  department_id?: string;

  vendor_name?: string;
  reference?: string;
  payment_method?: string;
}
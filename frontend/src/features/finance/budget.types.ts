export type BudgetStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'closed';

export interface Budget {
  id: string;
  budget_number: string;

  name: string;
  description?: string | null;

  fiscal_year: string;
  start_date: string;
  end_date: string;

  amount: number;
  currency: string;
  status: BudgetStatus;

  organisation_id?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
  project_id?: string | null;

  notes?: string | null;

  submitted_at?: string | null;
  approved_at?: string | null;
  activated_at?: string | null;
  closed_at?: string | null;

  submitted_by_id?: string | null;
  approved_by_id?: string | null;
  activated_by_id?: string | null;
  closed_by_id?: string | null;
  created_by_id?: string | null;

  created_at: string;
  updated_at: string;
}

export interface CreateBudgetPayload {
  name: string;
  description?: string;
  fiscal_year: string;
  start_date: string;
  end_date: string;
  amount: number;
  currency: string;

  organisation_id?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;

  notes?: string;
}

export interface UpdateBudgetPayload {
  name?: string;
  description?: string;
  fiscal_year?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  currency?: string;

  organisation_id?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;

  notes?: string;
}

export interface BudgetSubmissionPayload {
  notes?: string;
}

export interface BudgetApprovalPayload {
  notes?: string;
}

export interface BudgetClosurePayload {
  reason: string;
}

export interface BudgetListParams {
  status?: BudgetStatus;
  fiscal_year?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;
  search?: string;
}
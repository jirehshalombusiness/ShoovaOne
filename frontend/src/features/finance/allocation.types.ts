export type AllocationStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'closed';

export interface Allocation {
  id: string;
  allocation_number: string;

  budget_id: string;

  name: string;
  description?: string | null;

  amount: number;
  currency: string;

  status: AllocationStatus;

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

export interface CreateAllocationPayload {
  budget_id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  organisation_id?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;
  notes?: string;
}

export interface UpdateAllocationPayload {
  name?: string;
  description?: string;
  amount?: number;
  currency?: string;
  organisation_id?: string;
  department_id?: string;
  programme_id?: string;
  project_id?: string;
  notes?: string;
}

export interface AllocationSubmissionPayload {
  notes?: string;
}

export interface AllocationApprovalPayload {
  notes?: string;
}

export interface AllocationClosurePayload {
  reason: string;
}

export interface AllocationListParams {
  budget_id?: string;
  status?: AllocationStatus;
  department_id?: string;
  programme_id?: string;
  project_id?: string;
  search?: string;
}
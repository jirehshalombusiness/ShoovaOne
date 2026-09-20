import { api } from './api';

// ============================================================
// APPROVALS
// ============================================================

export interface ApprovalRequesterInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  job_title: string | null;
}

export interface ApprovalComment {
  id: string;
  author_id: string;
  author_name: string;
  author_image: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface ApprovalDetailLink {
  kind: string;
  payload: Record<string, unknown> | null;
}

export interface ApprovalSummary {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  escalation_level: number;
  due_at: string | null;
  escalated_at: string | null;
  created_at: string;
  requested_by: ApprovalRequesterInfo;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  decided_at: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  can_act: boolean;
}

export interface ApprovalDetail extends ApprovalSummary {
  comments: ApprovalComment[];
  detail: ApprovalDetailLink | null;
}

export interface ApprovalListResponse {
  items: ApprovalSummary[];
  total: number;
  pending: number;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  overdue: number;
  by_type: Record<string, number>;
}

// ============================================================
// EMPLOYEES
// ============================================================

export interface EmployeeListItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  type: string;
  status: string | null;
  job_title: string | null;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  employee_number: string | null;
  profile_image_url: string | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
}

export interface EmployeeListResponse {
  items: EmployeeListItem[];
  total: number;
}

export interface EmployeePerson {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  type: string;
  status: string | null;
  job_title: string | null;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  employee_number: string | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
  profile_image_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  bio: string | null;
  skills: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeeContract {
  id: string;
  contract_type: string;
  position: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
  compensation_amount: number | null;
  compensation_currency: string | null;
  compensation_frequency: string | null;
  document_id: string | null;
  is_current: boolean;
}

export interface EmployeeLeaveBalance {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
}

export interface EmployeeDevice {
  assignment_id: string;
  device_id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  assigned_at: string | null;
}

export interface EmployeeDocument {
  id: string;
  name: string;
  file_url: string;
  mime_type: string | null;
  verified: boolean;
  expiry_date: string | null;
  created_at: string;
}

export interface EmployeeNote {
  id: string;
  category: string;
  title: string | null;
  content: string;
  is_sensitive: boolean;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EmployeeProject {
  id: string;
  name: string;
  code: string | null;
  status: string;
  role: string | null;
}

export interface EmployeeTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
}

export interface EmployeeOrgNeighbor {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  profile_image_url: string | null;
}

export interface EmployeeDetail {
  person: EmployeePerson;
  contracts: EmployeeContract[];
  leave_balances: EmployeeLeaveBalance[];
  devices: EmployeeDevice[];
  documents: EmployeeDocument[];
  notes: EmployeeNote[];
  projects: EmployeeProject[];
  tasks: EmployeeTask[];
  manager: EmployeeOrgNeighbor | null;
  direct_reports: EmployeeOrgNeighbor[];
}

export interface EmployeeUpdate {
  // Contact — applied instantly
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  location?: string;
  employee_number?: string;
  profile_image_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  bio?: string;
  skills?: string;

  // Structural — creates an approval request
  job_title?: string;
  department?: string;
  employment_type?: string;
  reports_to_id?: string;
  status?: string;
  type?: string;
}

export interface EmployeeUpdateResponse {
  applied: Record<string, unknown>;
  pending_approval_id: string | null;
  pending_fields: string[];
}

export interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_department: Record<string, number>;
}

export interface EmployeeTimelineEntry {
  id: string;
  action: string;
  description: string | null;
  entity_type: string;
  entity_id: string;
  actor_name: string | null;
  actor_image: string | null;
  created_at: string;
}

// ============================================================
// TIME OFF (admin)
// ============================================================

export interface AdminLeaveRequester {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  job_title: string | null;
  department: string | null;
}

export interface AdminLeaveRequest {
  id: string;
  person_id: string;
  person: AdminLeaveRequester;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  approved_by_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  approval_id: string | null;
  approval_status: string | null;
  approval_assigned_to_id: string | null;
  approval_assigned_to_name: string | null;
}

export interface AdminLeaveListResponse {
  items: AdminLeaveRequest[];
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface AdminLeaveBalance {
  id: string;
  person_id: string;
  person_name: string;
  person_image: string | null;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_over_days: number;
  remaining_days: number;
}

export interface LeaveStats {
  pending: number;
  approved_this_month: number;
  rejected_this_month: number;
  currently_on_leave: number;
  upcoming_7_days: number;
  by_type: Record<string, number>;
}

export interface LeaveCalendarEntry {
  id: string;
  person_id: string;
  person_name: string;
  person_image: string | null;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
}

// ============================================================
// LEAVE POLICIES
// ============================================================

export interface LeaveTypeAdmin {
  id: string;
  name: string;
  code: string;
  default_days: number;
  is_paid: boolean;
  requires_approval: boolean;
  requires_documentation: boolean;
  color: string;
  is_active: boolean;
  balances_count: number;
}

export interface LeaveTypeCreate {
  name: string;
  code: string;
  default_days?: number;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_documentation?: boolean;
  color?: string;
  is_active?: boolean;
}

export interface LeaveTypeUpdate {
  name?: string;
  default_days?: number;
  is_paid?: boolean;
  requires_approval?: boolean;
  requires_documentation?: boolean;
  color?: string;
  is_active?: boolean;
}

export interface PublicHolidayAdmin {
  id: string;
  name: string;
  holiday_date: string;
  country: string;
  is_paid: boolean;
  notes: string | null;
}

export interface PublicHolidayCreate {
  name: string;
  holiday_date: string;
  country?: string;
  is_paid?: boolean;
  notes?: string;
}

// ============================================================
// CONTRACTS
// ============================================================

export interface ContractPerson {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  job_title: string | null;
  department: string | null;
  employee_number: string | null;
}

export interface ContractResponse {
  id: string;
  person_id: string;
  person: ContractPerson;
  contract_type: string;
  position: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
  compensation_amount: number | null;
  compensation_currency: string | null;
  compensation_frequency: string | null;
  document_id: string | null;
  is_current: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ContractListResponse {
  items: ContractResponse[];
  total: number;
  current: number;
  ending_soon: number;
}

export interface ContractStats {
  total: number;
  active: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  by_type: Record<string, number>;
}

export interface ContractCreate {
  person_id: string;
  contract_type: string;
  position?: string;
  department?: string;
  start_date: string;
  end_date?: string;
  reports_to_id?: string;
  compensation_amount?: number;
  compensation_currency?: string;
  compensation_frequency?: string;
  document_id?: string;
  notes?: string;
  is_current?: boolean;
}

export interface ContractUpdate {
  contract_type?: string;
  position?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  reports_to_id?: string;
  compensation_amount?: number;
  compensation_currency?: string;
  compensation_frequency?: string;
  document_id?: string;
  notes?: string;
  is_current?: boolean;
}

export interface ContractRenewRequest {
  new_start_date: string;
  new_end_date?: string;
  new_contract_type?: string;
  new_compensation_amount?: number;
  notes?: string;
}

// ============================================================
// COMPENSATION
// ============================================================

export interface CompensationPerson {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  job_title: string | null;
  department: string | null;
}

export interface CompensationItem {
  id: string;
  person_id: string;
  person: CompensationPerson;
  base_amount: number;
  currency: string;
  frequency: string;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
  notes: string | null;
  approved_by_id: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  is_current: boolean;
}

export interface CompensationListResponse {
  items: CompensationItem[];
  total: number;
}

export interface CompensationCreate {
  person_id: string;
  base_amount: number;
  currency?: string;
  frequency?: string;
  effective_from: string;
  reason?: string;
  notes?: string;
}

export interface CompensationCreateResponse {
  id: string;
  status: string;
  message: string;
  approval_id: string | null;
}

// ============================================================
// CELEBRATIONS
// ============================================================

export interface CelebrationItem {
  id: string;
  kind: 'birthday' | 'anniversary';
  person_id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  job_title: string | null;
  department: string | null;
  date: string;
  days_away: number;
  years: number;
  label: string;
}

export interface CelebrationsResponse {
  items: CelebrationItem[];
  birthdays_count: number;
  anniversaries_count: number;
  window_days: number;
}

// ============================================================
// DOCUMENTS (admin)
// ============================================================

export interface DocumentPersonInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
  department: string | null;
}

export interface HRDocumentAdmin {
  id: string;
  name: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  type: string | null;
  visibility: string;
  version: number;
  document_type_id: string | null;
  document_type_name: string | null;
  expiry_date: string | null;
  verified: boolean;
  verified_by_id: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  owner_id: string | null;
  owner: DocumentPersonInfo | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface HRDocumentListResponse {
  items: HRDocumentAdmin[];
  total: number;
  unverified: number;
  expiring_30: number;
  expired: number;
}

export interface DocumentTypeAdmin {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  applies_to: string;
  validity_months: number | null;
  documents_count: number;
}

export interface DocumentTypeCreate {
  name: string;
  description?: string;
  is_required?: boolean;
  applies_to?: string;
  validity_months?: number;
}

// ============================================================
// REPORTS
// ============================================================

export interface HeadcountBucket {
  label: string;
  count: number;
}

export interface HeadcountReport {
  total: number;
  active: number;
  inactive: number;
  by_type: HeadcountBucket[];
  by_department: HeadcountBucket[];
  by_status: HeadcountBucket[];
  by_employment_type: HeadcountBucket[];
  by_location: HeadcountBucket[];
  hired_this_year: number;
  left_this_year: number;
}

export interface TurnoverMonth {
  month: string;
  hires: number;
  terminations: number;
  net: number;
}

export interface TurnoverReport {
  months: TurnoverMonth[];
  rolling_12_month_rate: number;
  total_hires: number;
  total_terminations: number;
}

export interface LeaveUsageRow {
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  total_days_requested: number;
  total_days_approved: number;
  total_days_rejected: number;
  requests_count: number;
  avg_days_per_request: number;
}

export interface LeaveUsageReport {
  year: number;
  rows: LeaveUsageRow[];
  total_approved_days: number;
  total_pending_days: number;
  most_used_type: string | null;
}

export interface DepartmentCompRow {
  department: string;
  headcount: number;
  avg_base_amount: number;
  min_base_amount: number;
  max_base_amount: number;
  currency: string;
}

export interface CompensationReport {
  rows: DepartmentCompRow[];
  total_annual_cost: number;
  currency: string;
  headcount_with_salary: number;
}

export interface ContractExpiryRow {
  contract_id: string;
  person_id: string;
  person_name: string;
  contract_type: string;
  position: string | null;
  end_date: string;
  days_until_expiry: number;
}

export interface ContractExpiryReport {
  within_30: ContractExpiryRow[];
  within_60: ContractExpiryRow[];
  within_90: ContractExpiryRow[];
}

// ============================================================
// SERVICE
// ============================================================

export const hrService = {
  // ---------------- APPROVALS ----------------
  async getApprovals(params?: {
    status?: string;
    entity_types?: string;
    assigned_to_me?: boolean;
    include_all_if_hr?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ApprovalListResponse> {
    const { data } = await api.get<ApprovalListResponse>('/hr/approvals', { params });
    return data;
  },

  async getApproval(id: string): Promise<ApprovalDetail> {
    const { data } = await api.get<ApprovalDetail>(`/hr/approvals/${id}`);
    return data;
  },

  async approveRequest(id: string, note?: string): Promise<ApprovalDetail> {
    const { data } = await api.post<ApprovalDetail>(`/hr/approvals/${id}/approve`, {
      note,
    });
    return data;
  },

  async rejectRequest(id: string, note: string): Promise<ApprovalDetail> {
    const { data } = await api.post<ApprovalDetail>(`/hr/approvals/${id}/reject`, {
      note,
    });
    return data;
  },

  async escalateRequest(id: string): Promise<ApprovalDetail> {
    const { data } = await api.post<ApprovalDetail>(`/hr/approvals/${id}/escalate`);
    return data;
  },

  async addApprovalComment(
    id: string,
    payload: { body: string; is_internal?: boolean },
  ): Promise<ApprovalComment> {
    const { data } = await api.post<ApprovalComment>(
      `/hr/approvals/${id}/comments`,
      payload,
    );
    return data;
  },

  async getMyApprovalStats(): Promise<ApprovalStats> {
    const { data } = await api.get<ApprovalStats>('/hr/approvals/stats/me');
    return data;
  },

  async getAdminApprovals(params?: {
    status?: string;
    entity_types?: string;
    requested_by_id?: string;
    assigned_to_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApprovalListResponse> {
    const { data } = await api.get<ApprovalListResponse>('/hr/approvals/admin/all', {
      params,
    });
    return data;
  },

  // ---------------- EMPLOYEES ----------------
  async listEmployees(params?: {
    search?: string;
    type?: string;
    status?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<EmployeeListResponse> {
    const { data } = await api.get<EmployeeListResponse>('/hr/employees', { params });
    return data;
  },

  async getEmployee(id: string): Promise<EmployeeDetail> {
    const { data } = await api.get<EmployeeDetail>(`/hr/employees/${id}`);
    return data;
  },

  async updateEmployee(
    id: string,
    payload: EmployeeUpdate,
  ): Promise<EmployeeUpdateResponse> {
    const { data } = await api.patch<EmployeeUpdateResponse>(
      `/hr/employees/${id}`,
      payload,
    );
    return data;
  },

  async createEmployeeNote(
    personId: string,
    payload: { category?: string; title?: string; content: string; is_sensitive?: boolean },
  ): Promise<EmployeeNote> {
    const { data } = await api.post<EmployeeNote>(
      `/hr/employees/${personId}/notes`,
      payload,
    );
    return data;
  },

  async updateEmployeeNote(
    personId: string,
    noteId: string,
    payload: { category?: string; title?: string; content?: string; is_sensitive?: boolean },
  ): Promise<EmployeeNote> {
    const { data } = await api.patch<EmployeeNote>(
      `/hr/employees/${personId}/notes/${noteId}`,
      payload,
    );
    return data;
  },

  async deleteEmployeeNote(personId: string, noteId: string): Promise<void> {
    await api.delete(`/hr/employees/${personId}/notes/${noteId}`);
  },

  async terminateEmployee(
    id: string,
    payload: { reason: string; last_working_day?: string; deactivate_user?: boolean },
  ): Promise<EmployeePerson> {
    const { data } = await api.post<EmployeePerson>(
      `/hr/employees/${id}/terminate`,
      payload,
    );
    return data;
  },

  async getEmployeeTimeline(
    id: string,
    params?: { limit?: number; offset?: number },
  ): Promise<EmployeeTimelineEntry[]> {
    const { data } = await api.get<EmployeeTimelineEntry[]>(
      `/hr/employees/${id}/timeline`,
      { params },
    );
    return data;
  },

  async getEmployeeStats(): Promise<EmployeeStats> {
    const { data } = await api.get<EmployeeStats>('/hr/employees/stats');
    return data;
  },

  // ---------------- TIME OFF (admin) ----------------
  async listAllLeaveRequests(params?: {
    status?: string;
    leave_type_id?: string;
    person_id?: string;
    department?: string;
    start_from?: string;
    end_before?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminLeaveListResponse> {
    const { data } = await api.get<AdminLeaveListResponse>('/hr/time-off', { params });
    return data;
  },

  async getLeaveStats(): Promise<LeaveStats> {
    const { data } = await api.get<LeaveStats>('/hr/time-off/stats');
    return data;
  },

  async listAllBalances(params?: {
    year?: number;
    leave_type_id?: string;
    person_id?: string;
    department?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminLeaveBalance[]> {
    const { data } = await api.get<AdminLeaveBalance[]>('/hr/time-off/balances', {
      params,
    });
    return data;
  },

  async createBalance(payload: {
    person_id: string;
    leave_type_id: string;
    year: number;
    total_days: number;
    carry_over_days?: number;
  }): Promise<AdminLeaveBalance> {
    const { data } = await api.post<AdminLeaveBalance>(
      '/hr/time-off/balances',
      payload,
    );
    return data;
  },

  async adjustBalance(
    balanceId: string,
    payload: { new_total_days?: number; new_carry_over_days?: number; note?: string },
  ): Promise<AdminLeaveBalance> {
    const { data } = await api.patch<AdminLeaveBalance>(
      `/hr/time-off/balances/${balanceId}`,
      payload,
    );
    return data;
  },

  async ensureYearBalances(year: number): Promise<{
    year: number;
    people_processed: number;
    balances_created: number;
  }> {
    const { data } = await api.post('/hr/time-off/balances/ensure-year', null, {
      params: { year },
    });
    return data;
  },

  async getTeamCalendar(params: {
    start: string;
    end: string;
    department?: string;
    leave_type_id?: string;
  }): Promise<LeaveCalendarEntry[]> {
    const { data } = await api.get<LeaveCalendarEntry[]>('/hr/time-off/calendar', {
      params,
    });
    return data;
  },

  // ---------------- LEAVE POLICIES ----------------
  async listLeaveTypes(includeInactive = false): Promise<LeaveTypeAdmin[]> {
    const { data } = await api.get<LeaveTypeAdmin[]>('/hr/leave-policies/types', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createLeaveType(payload: LeaveTypeCreate): Promise<LeaveTypeAdmin> {
    const { data } = await api.post<LeaveTypeAdmin>(
      '/hr/leave-policies/types',
      payload,
    );
    return data;
  },

  async updateLeaveType(id: string, payload: LeaveTypeUpdate): Promise<LeaveTypeAdmin> {
    const { data } = await api.patch<LeaveTypeAdmin>(
      `/hr/leave-policies/types/${id}`,
      payload,
    );
    return data;
  },

  async deleteLeaveType(id: string): Promise<void> {
    await api.delete(`/hr/leave-policies/types/${id}`);
  },

  async listHolidays(year?: number, country?: string): Promise<PublicHolidayAdmin[]> {
    const { data } = await api.get<PublicHolidayAdmin[]>(
      '/hr/leave-policies/holidays',
      { params: { year, country } },
    );
    return data;
  },

  async createHoliday(payload: PublicHolidayCreate): Promise<PublicHolidayAdmin> {
    const { data } = await api.post<PublicHolidayAdmin>(
      '/hr/leave-policies/holidays',
      payload,
    );
    return data;
  },

  async updateHoliday(
    id: string,
    payload: Partial<PublicHolidayCreate>,
  ): Promise<PublicHolidayAdmin> {
    const { data } = await api.patch<PublicHolidayAdmin>(
      `/hr/leave-policies/holidays/${id}`,
      payload,
    );
    return data;
  },

  async deleteHoliday(id: string): Promise<void> {
    await api.delete(`/hr/leave-policies/holidays/${id}`);
  },

  // ---------------- CONTRACTS ----------------
  async listContracts(params?: {
    person_id?: string;
    contract_type?: string;
    is_current?: boolean;
    expiring_in_days?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractListResponse> {
    const { data } = await api.get<ContractListResponse>('/hr/contracts', { params });
    return data;
  },

  async getContract(id: string): Promise<ContractResponse> {
    const { data } = await api.get<ContractResponse>(`/hr/contracts/${id}`);
    return data;
  },

  async createContract(payload: ContractCreate): Promise<ContractResponse> {
    const { data } = await api.post<ContractResponse>('/hr/contracts', payload);
    return data;
  },

  async updateContract(id: string, payload: ContractUpdate): Promise<ContractResponse> {
    const { data } = await api.patch<ContractResponse>(`/hr/contracts/${id}`, payload);
    return data;
  },

  async renewContract(
    id: string,
    payload: ContractRenewRequest,
  ): Promise<ContractResponse> {
    const { data } = await api.post<ContractResponse>(
      `/hr/contracts/${id}/renew`,
      payload,
    );
    return data;
  },

  async terminateContract(id: string, endDate?: string): Promise<ContractResponse> {
    const { data } = await api.post<ContractResponse>(
      `/hr/contracts/${id}/terminate`,
      null,
      { params: endDate ? { end_date: endDate } : {} },
    );
    return data;
  },

  async getContractStats(): Promise<ContractStats> {
    const { data } = await api.get<ContractStats>('/hr/contracts/stats');
    return data;
  },

  // ---------------- COMPENSATION ----------------
  async listCompensation(params?: {
    person_id?: string;
    current_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CompensationListResponse> {
    const { data } = await api.get<CompensationListResponse>('/hr/compensation', {
      params,
    });
    return data;
  },

  async getPersonCompensation(personId: string): Promise<CompensationItem[]> {
    const { data } = await api.get<CompensationItem[]>(
      `/hr/compensation/person/${personId}`,
    );
    return data;
  },

  async createCompensation(
    payload: CompensationCreate,
  ): Promise<CompensationCreateResponse> {
    const { data } = await api.post<CompensationCreateResponse>(
      '/hr/compensation',
      payload,
    );
    return data;
  },

  async updateCompensation(
    id: string,
    payload: Partial<CompensationCreate>,
  ): Promise<CompensationItem> {
    const { data } = await api.patch<CompensationItem>(`/hr/compensation/${id}`, payload);
    return data;
  },

  // ---------------- CELEBRATIONS ----------------
  async getCelebrations(params?: {
    days_ahead?: number;
    include_birthdays?: boolean;
    include_anniversaries?: boolean;
    department?: string;
  }): Promise<CelebrationsResponse> {
    const { data } = await api.get<CelebrationsResponse>('/hr/celebrations', {
      params,
    });
    return data;
  },

  // ---------------- DOCUMENTS (admin) ----------------
  async listDocuments(params?: {
    person_id?: string;
    document_type_id?: string;
    verified?: boolean;
    expiring_in_days?: number;
    expired_only?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<HRDocumentListResponse> {
    const { data } = await api.get<HRDocumentListResponse>('/hr/documents', {
      params,
    });
    return data;
  },

  async getDocument(id: string): Promise<HRDocumentAdmin> {
    const { data } = await api.get<HRDocumentAdmin>(`/hr/documents/${id}`);
    return data;
  },

  async verifyDocument(id: string, note?: string): Promise<HRDocumentAdmin> {
    const { data } = await api.post<HRDocumentAdmin>(
      `/hr/documents/${id}/verify`,
      { note },
    );
    return data;
  },

  async unverifyDocument(id: string, note?: string): Promise<HRDocumentAdmin> {
    const { data } = await api.post<HRDocumentAdmin>(
      `/hr/documents/${id}/unverify`,
      { note },
    );
    return data;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/hr/documents/${id}`);
  },

  async listDocumentTypes(): Promise<DocumentTypeAdmin[]> {
    const { data } = await api.get<DocumentTypeAdmin[]>('/hr/documents/types/all');
    return data;
  },

  async createDocumentType(payload: DocumentTypeCreate): Promise<DocumentTypeAdmin> {
    const { data } = await api.post<DocumentTypeAdmin>(
      '/hr/documents/types/all',
      payload,
    );
    return data;
  },

  async updateDocumentType(
    id: string,
    payload: Partial<DocumentTypeCreate>,
  ): Promise<DocumentTypeAdmin> {
    const { data } = await api.patch<DocumentTypeAdmin>(
      `/hr/documents/types/all/${id}`,
      payload,
    );
    return data;
  },

  async deleteDocumentType(id: string): Promise<void> {
    await api.delete(`/hr/documents/types/all/${id}`);
  },

  // ---------------- REPORTS ----------------
  async getHeadcountReport(): Promise<HeadcountReport> {
    const { data } = await api.get<HeadcountReport>('/hr/reports/headcount');
    return data;
  },

  async getTurnoverReport(monthsBack = 12): Promise<TurnoverReport> {
    const { data } = await api.get<TurnoverReport>('/hr/reports/turnover', {
      params: { months_back: monthsBack },
    });
    return data;
  },

  async getLeaveUsageReport(year?: number): Promise<LeaveUsageReport> {
    const { data } = await api.get<LeaveUsageReport>('/hr/reports/leave-usage', {
      params: year ? { year } : {},
    });
    return data;
  },

  async getCompensationReport(): Promise<CompensationReport> {
    const { data } = await api.get<CompensationReport>('/hr/reports/compensation');
    return data;
  },

  async getContractsExpiring(): Promise<ContractExpiryReport> {
    const { data } = await api.get<ContractExpiryReport>(
      '/hr/reports/contracts-expiring',
    );
    return data;
  },
};
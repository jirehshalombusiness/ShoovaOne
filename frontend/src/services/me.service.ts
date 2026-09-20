import { api } from './api';

// ============================================================
// TYPES
// ============================================================

export interface MeHomePerson {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  profile_image_url: string | null;
  department: string | null;
  location: string | null;
}

export interface MeHomeBalance {
  id: string;
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

export interface MeHomeHoliday {
  id: string;
  name: string;
  holiday_date: string;
  country: string;
  is_paid: boolean;
}

export interface MeHomeLeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: string;
  created_at: string;
}

export interface MeHomeApproval {
  id: string;
  title: string;
  entity_type: string;
  due_at: string | null;
  created_at: string;
}

export interface MeHome {
  person: MeHomePerson;
  balances: MeHomeBalance[];
  upcoming_holidays: MeHomeHoliday[];
  recent_requests: MeHomeLeaveRequest[];
  pending_approvals: MeHomeApproval[];
  devices_count: number;
  documents_pending: number;
}

export interface MeProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  job_title: string | null;
  location: string | null;
  employment_type: string | null;
  type: string;
  status: string;
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
  created_at: string;   // ← ADD
  updated_at: string;   // ← ADD
}

export interface MeProfileUpdate {
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  bio?: string;
  profile_image_url?: string;
}

export interface MeOrgPerson {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  profile_image_url: string | null;
  location: string | null;
}

export interface MeOrg {
  me: MeOrgPerson;
  manager: MeOrgPerson | null;
  direct_reports: MeOrgPerson[];
  contract_summary: {
    contract_type: string;
    position: string | null;
    department: string | null;
    start_date: string;
    end_date: string | null;
  } | null;
}

export interface MeBalance {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_code: string;
  leave_type_color: string;
  is_paid: boolean;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  carry_over_days: number;
  remaining_days: number;
}

export interface MeLeaveType {
  id: string;
  name: string;
  code: string;
  default_days: number;
  is_paid: boolean;
  color: string;
  requires_documentation: boolean;
  is_active: boolean;
}

export interface MeLeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  approval_id: string | null;
}

export interface MeLeaveRequestCreate {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  attachment_ids?: string[];
}

export interface MeHoliday {
  id: string;
  name: string;
  holiday_date: string;
  country: string;
  is_paid: boolean;
}

export interface MeApprovalItem {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  summary: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  created_at: string;
  requested_by_id: string;
  requested_by_name: string;
  requested_by_image: string | null;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
}

// ============================================================
// SERVICE
// ============================================================

export const meService = {
  // ---------------- HOME ----------------
  async getHome(): Promise<MeHome> {
    const { data } = await api.get<MeHome>('/me/home');
    return data;
  },

  // ---------------- PROFILE ----------------
  async getProfile(): Promise<MeProfile> {
    const { data } = await api.get<MeProfile>('/me/profile');
    return data;
  },

  async updateProfile(payload: MeProfileUpdate): Promise<MeProfile> {
    const { data } = await api.patch<MeProfile>('/me/profile', payload);
    return data;
  },

  // ---------------- ORG ----------------
  async getOrg(): Promise<MeOrg> {
    const { data } = await api.get<MeOrg>('/me/org');
    return data;
  },

  // ---------------- TIME OFF ----------------
  async getBalances(year?: number): Promise<MeBalance[]> {
    const params = year ? { year } : {};
    const { data } = await api.get<MeBalance[]>('/me/time-off/balances', { params });
    return data;
  },

  async getLeaveTypes(): Promise<MeLeaveType[]> {
    const { data } = await api.get<MeLeaveType[]>('/me/time-off/types');
    return data;
  },

  async getLeaveRequests(params?: {
    status_filter?: string;
    limit?: number;
    offset?: number;
  }): Promise<MeLeaveRequest[]> {
    const { data } = await api.get<MeLeaveRequest[]>('/me/time-off/requests', {
      params,
    });
    return data;
  },

  async getLeaveRequest(id: string): Promise<MeLeaveRequest> {
    const { data } = await api.get<MeLeaveRequest>(`/me/time-off/requests/${id}`);
    return data;
  },

  async createLeaveRequest(payload: MeLeaveRequestCreate): Promise<MeLeaveRequest> {
    const { data } = await api.post<MeLeaveRequest>('/me/time-off/requests', payload);
    return data;
  },

  async cancelLeaveRequest(id: string): Promise<MeLeaveRequest> {
    const { data } = await api.post<MeLeaveRequest>(
      `/me/time-off/requests/${id}/cancel`,
    );
    return data;
  },

  async getHolidays(daysAhead = 365): Promise<MeHoliday[]> {
    const { data } = await api.get<MeHoliday[]>('/me/time-off/holidays', {
      params: { days_ahead: daysAhead },
    });
    return data;
  },

  // ---------------- APPROVALS (outgoing + incoming preview) ----------------
  async getMyApprovals(status = 'pending'): Promise<MeApprovalItem[]> {
    const { data } = await api.get<MeApprovalItem[]>('/me/approvals', {
      params: { status_filter: status },
    });
    return data;
  },
};
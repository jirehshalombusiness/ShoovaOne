import { api } from './api';

export interface HREmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  type: string;
  status: string;
  job_title: string | null;
  location: string | null;
  employment_type: string | null;
  profile_image_url: string | null;
  date_of_birth: string | null;
}

export interface HRDocument {
  id: string;
  name: string;
  file_url: string;
  mime_type: string | null;
  verified: boolean;
  expiry_date: string | null;
  created_at: string;
}

export interface HRNote {
  id: string;
  category: string;
  title: string | null;
  content: string;
  author_id: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: string;
}

export interface HRProject {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export interface HRTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

export interface EmployeeDetail {
  person: HREmployee & {
    gender: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    emergency_contact_relationship: string | null;
    created_at: string;
  };
  documents: HRDocument[];
  notes: HRNote[];
  projects: HRProject[];
  tasks: HRTask[];
}

export interface Celebration {
  id: string;
  type: string;
  person_id: string;
  first_name: string;
  last_name: string;
  image_url: string | null;
  date: string;
  days_away: number;
  years: number;
  label: string;
}

export interface HROverview {
  total_people: number;
  active_staff: number;
  active_volunteers: number;
  birthdays_this_month: any[];
  pending_documents: number;
  documents_expiring_soon: any[];
  pending_leave_requests: number;
}

// Add these interfaces:
export interface MyHRHome {
  person: {
    id: string;
    first_name: string;
    last_name: string;
    job_title: string | null;
    profile_image_url: string | null;
  };
  balances: LeaveBalance[];
  upcoming_holidays: Holiday[];
  recent_requests: LeaveRequest[];
  devices_count: number;
  documents_pending: number;
}

export interface LeaveBalance {
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

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  default_days: number;
  is_paid: boolean;
  color: string;
  requires_documentation: boolean;
}

export interface LeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  country: string;
  is_paid: boolean;
}

export interface MyDevice {
  id: string;
  assignment_id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  condition: string;
  assigned_at: string | null;
}

export interface MyContract {
  id: string;
  contract_type: string;
  position: string | null;
  department: string | null;
  start_date: string;
  end_date: string | null;
  reports_to_id: string | null;
  reports_to_name: string | null;
  compensation_amount: number | null;
  compensation_currency: string;
  compensation_frequency: string;
  document_id: string | null;
  is_current: boolean;
}

export const hrService = {
  async getOverview(): Promise<HROverview> {
    const response = await api.get<HROverview>('/hr/overview');
    return response.data;
  },

// Add to hrService object:
async getMyHRHome(): Promise<MyHRHome> {
  const response = await api.get<MyHRHome>('/hr/home');
  return response.data;
},

async getMyBalances(): Promise<LeaveBalance[]> {
  const response = await api.get<LeaveBalance[]>('/hr/time-off/balances');
  return response.data;
},

async getLeaveTypes(): Promise<LeaveType[]> {
  const response = await api.get<LeaveType[]>('/hr/time-off/types');
  return response.data;
},

async getMyLeaveRequests(): Promise<LeaveRequest[]> {
  const response = await api.get<LeaveRequest[]>('/hr/time-off/requests');
  return response.data;
},

async requestLeave(data: {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<any> {
  const response = await api.post('/hr/time-off/requests', data);
  return response.data;
},

async getMyDevices(): Promise<MyDevice[]> {
  const response = await api.get<MyDevice[]>('/hr/devices');
  return response.data;
},

async getMyContracts(): Promise<MyContract[]> {
  const response = await api.get<MyContract[]>('/hr/contracts');
  return response.data;
},

async getHolidays(): Promise<Holiday[]> {
  const response = await api.get<Holiday[]>('/hr/holidays');
  return response.data;
},

  async getEmployees(params?: {
    search?: string;
    type?: string;
    status?: string;
  }): Promise<HREmployee[]> {
    const response = await api.get<HREmployee[]>('/hr/employees', { params });
    return response.data;
  },

  async getEmployee(id: string): Promise<EmployeeDetail> {
    const response = await api.get<EmployeeDetail>(`/hr/employees/${id}`);
    return response.data;
  },

  async getDocumentTypes(): Promise<any[]> {
    const response = await api.get<any[]>('/hr/document-types');
    return response.data;
  },

  async createNote(personId: string, data: {
    category?: string;
    title?: string;
    content: string;
  }): Promise<any> {
    const response = await api.post(`/hr/employees/${personId}/notes`, data);
    return response.data;
  },

  async getCelebrations(daysAhead = 30): Promise<Celebration[]> {
    const response = await api.get<Celebration[]>('/hr/celebrations', {
      params: { days_ahead: daysAhead },
    });
    return response.data;
  },
};
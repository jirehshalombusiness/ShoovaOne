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

export const hrService = {
  async getOverview(): Promise<HROverview> {
    const response = await api.get<HROverview>('/hr/overview');
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
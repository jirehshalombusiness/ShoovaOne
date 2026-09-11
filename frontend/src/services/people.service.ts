import { api } from './api';
import { Person, PersonRelationship, PersonActivity } from '@/types/person.types';

// =============================================
// FILTERS
// =============================================

export interface PeopleFilters {
  search?: string;
  type?: string;
  status?: string;
  organization?: string;
  department?: string;
  role?: string;
  skip?: number;
  limit?: number;
}

// =============================================
// ORG CHART TYPES
// =============================================

export interface OrgNode {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  location: string | null;
  profile_image_url: string | null;
  reports_to_id: string | null;
  direct_reports_count: number;
}

export interface OrgChartResponse {
  nodes: OrgNode[];
  roots: string[];
}

// =============================================
// SERVICE
// =============================================

export const peopleService = {
  // ---------- PEOPLE CRUD ----------
  async getAll(params?: PeopleFilters): Promise<Person[]> {
    const response = await api.get<Person[]>('/people', { params });
    return response.data;
  },

  async getById(id: string): Promise<Person> {
    const response = await api.get<Person>(`/people/${id}`);
    return response.data;
  },

  async create(data: Partial<Person>): Promise<Person> {
    const response = await api.post<Person>('/people', data);
    return response.data;
  },

  async update(id: string, data: Partial<Person>): Promise<Person> {
    const response = await api.put<Person>(`/people/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/people/${id}`);
  },

  async archive(id: string): Promise<Person> {
    const response = await api.patch<Person>(`/people/${id}/archive`);
    return response.data;
  },

  async restore(id: string): Promise<Person> {
    const response = await api.patch<Person>(`/people/${id}/restore`);
    return response.data;
  },

  // ---------- RELATIONSHIPS & ACTIVITY ----------
  async getRelationships(personId: string): Promise<PersonRelationship[]> {
    const response = await api.get<PersonRelationship[]>(
      `/people/${personId}/relationships`
    );
    return response.data;
  },

  async getActivity(personId: string): Promise<PersonActivity[]> {
    const response = await api.get<PersonActivity[]>(
      `/people/${personId}/activity`
    );
    return response.data;
  },

  async checkDuplicate(data: Partial<Person>): Promise<Person[]> {
    const response = await api.post<Person[]>('/people/check-duplicate', data);
    return response.data;
  },

  // ---------- ORG CHART ----------
  async getOrgChart(): Promise<OrgChartResponse> {
    const response = await api.get<OrgChartResponse>('/people/org-chart');
    return response.data;
  },

  async updateReportsTo(
    personId: string,
    reportsToId: string | null
  ): Promise<Person> {
    const response = await api.put<Person>(`/people/${personId}/reports-to`, {
      reports_to_id: reportsToId,
    });
    return response.data;
  },
};
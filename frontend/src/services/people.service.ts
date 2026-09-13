import { api } from './api';
import { Person, PersonRelationship, PersonActivity } from '@/types/person.types';
import { Milestone, ProjectMember } from './project.service';

export interface ProjectTimesheetsData {
  total_hours: number;
  people: {
    person_id: string;
    first_name: string;
    last_name: string;
    profile_image_url: string | null;
    total_hours: number;
    entry_count: number;
  }[];
  recent_entries: {
    id: string;
    date: string | null;
    duration: number;
    description: string | null;
    person_first_name: string;
    person_last_name: string;
    person_image_url: string | null;
  }[];
}

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

  // Add to the ProjectService object:

  async getProjectTimesheets(projectId: string): Promise<ProjectTimesheetsData> {
    const response = await api.get<ProjectTimesheetsData>(`/projects/${projectId}/timesheets`);
    return response.data;
  },

  async createMilestone(projectId: string, data: Partial<Milestone>): Promise<Milestone> {
    const response = await api.post<Milestone>(`/projects/${projectId}/milestones`, data);
    return response.data;
  },

  async updateMilestone(milestoneId: string, data: Partial<Milestone>): Promise<Milestone> {
    const response = await api.put<Milestone>(`/projects/milestones/${milestoneId}`, data);
    return response.data;
  },

  async deleteMilestone(milestoneId: string): Promise<void> {
    await api.delete(`/projects/milestones/${milestoneId}`);
  },

  async addMember(projectId: string, personId: string, role: string = 'member'): Promise<ProjectMember> {
    const response = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
      project_id: projectId,
      person_id: personId,
      role,
    });
    return response.data;
  },

  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/projects/members/${memberId}`);
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
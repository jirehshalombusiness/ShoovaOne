import { api } from './api';

export interface Organization {
  id: string;
  name: string;
  type: 'government' | 'ngo' | 'corporate' | 'school' | 'community' | 'other';
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  created_at: string;
  updated_at: string;
}

export const organizationService = {
  async getAll(params?: { search?: string }): Promise<Organization[]> {
    const response = await api.get<Organization[]>('/organizations', { params });
    return response.data;
  },

  async getById(id: string): Promise<Organization> {
    const response = await api.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  async create(data: Partial<Organization>): Promise<Organization> {
    const response = await api.post<Organization>('/organizations', data);
    return response.data;
  },
};
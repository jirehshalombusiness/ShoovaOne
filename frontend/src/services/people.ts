import { api } from './api';

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone?: string;
  type: string;
  created_at: string;
}

export const peopleService = {
  async getAll(params?: { search?: string; type?: string; skip?: number; limit?: number }) {
    const response = await api.get<Person[]>('/people/', { params });
    return response.data;
  },

  async getById(id: string) {
    const response = await api.get<Person>(`/people/${id}`);
    return response.data;
  },

  async create(data: Partial<Person>) {
    const response = await api.post<Person>('/people/', data);
    return response.data;
  },

  async update(id: string, data: Partial<Person>) {
    const response = await api.put<Person>(`/people/${id}`, data);
    return response.data;
  },

  async delete(id: string) {
    await api.delete(`/people/${id}`);
  },
};
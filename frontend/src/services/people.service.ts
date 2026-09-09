import { api } from './api';
import { Person, PersonRelationship, PersonActivity } from '@/types/person.types';

export interface PeopleFilters {
  search?: string;
  type?: string;
  skip?: number;
  limit?: number;
}

export const peopleService = {
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

  async getRelationships(personId: string): Promise<PersonRelationship[]> {
    const response = await api.get<PersonRelationship[]>(`/people/${personId}/relationships`);
    return response.data;
  },

  async getActivity(personId: string): Promise<PersonActivity[]> {
    const response = await api.get<PersonActivity[]>(`/people/${personId}/activity`);
    return response.data;
  },

  async checkDuplicate(data: Partial<Person>): Promise<Person[]> {
    const response = await api.post<Person[]>('/people/check-duplicate', data);
    return response.data;
  },
};
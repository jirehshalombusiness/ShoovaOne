import { api } from './api';
import { User } from '@/types/user.types';

export interface ManagedUser extends User {
  person_id: string;
}

export const usersService = {
  async getAll(): Promise<ManagedUser[]> {
    const response = await api.get<ManagedUser[]>('/users');
    return response.data;
  },
  async create(person_id: string, password: string, role_names: string[]): Promise<ManagedUser> {
    const response = await api.post<ManagedUser>('/users', { person_id, password, role_names });
    return response.data;
  },
  async update(id: string, data: { is_active?: boolean; password?: string; role_names?: string[] }): Promise<ManagedUser> {
    const response = await api.patch<ManagedUser>(`/users/${id}`, data);
    return response.data;
  },
};

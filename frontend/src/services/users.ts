import { api } from './api';
import { User } from '@/types/user.types';

export interface ManagedUser extends User {
  person_id: string;
}

export interface AvailablePermission {
  id: string;
  resource: string;
  action: string;
  name: string;
  description?: string | null;
}

export interface UserPermissionsResponse {
  user_id: string;
  roles: string[];
  permissions: string[];
  direct_permissions: string[];
}

export const usersService = {
  async getAll(): Promise<ManagedUser[]> {
    const response = await api.get<ManagedUser[]>('/users/');
    return response.data;
  },

  async create(
    person_id: string,
    password: string,
    role_names: string[],
  ): Promise<ManagedUser> {
    const response = await api.post<ManagedUser>('/users', {
      person_id,
      password,
      role_names,
    });

    return response.data;
  },

  async update(
    id: string,
    data: {
      is_active?: boolean;
      password?: string;
      role_names?: string[];
    },
  ): Promise<ManagedUser> {
    const response = await api.patch<ManagedUser>(
      `/users/${id}`,
      data,
    );

    return response.data;
  },

  async getAvailablePermissions(): Promise<AvailablePermission[]> {
    const response = await api.get<AvailablePermission[]>(
      '/users/permissions/available',
    );

    return response.data;
  },

  async getUserPermissions(
    userId: string,
  ): Promise<UserPermissionsResponse> {
    const response = await api.get<UserPermissionsResponse>(
      `/users/${userId}/permissions`,
    );

    return response.data;
  },

  async grantPermission(
    userId: string,
    permission: string,
  ): Promise<void> {
    await api.post(`/users/${userId}/permissions`, {
      permission,
    });
  },

  async revokePermission(
    userId: string,
    permissionId: string,
  ): Promise<void> {
    await api.delete(
      `/users/${userId}/permissions/${permissionId}`,
    );
  },
};
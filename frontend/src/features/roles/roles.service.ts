import { api } from '../../services/api'

import type {
  Permission,
  Role,
  RoleCreatePayload,
  RoleDetail,
  RolePermissionsUpdatePayload,
  RoleUpdatePayload,
} from './roles.types';

export const rolesService = {
  async getRoles(): Promise<Role[]> {
    const response = await api.get('/roles');
    return response.data;
  },

  async getPermissions(): Promise<Permission[]> {
    const response = await api.get('/roles/permissions');
    return response.data;
  },

  async getRole(roleId: string): Promise<RoleDetail> {
    const response = await api.get(`/roles/${roleId}`);
    return response.data;
  },

  async createRole(payload: RoleCreatePayload): Promise<Role> {
    const response = await api.post('/roles', payload);
    return response.data;
  },

  async updateRole(
    roleId: string,
    payload: RoleUpdatePayload,
  ): Promise<Role> {
    const response = await api.patch(`/roles/${roleId}`, payload);
    return response.data;
  },

  async updateRolePermissions(
    roleId: string,
    payload: RolePermissionsUpdatePayload,
  ): Promise<RoleDetail> {
    const response = await api.put(
      `/roles/${roleId}/permissions`,
      payload,
    );

    return response.data;
  },

  async deleteRole(roleId: string): Promise<void> {
    await api.delete(`/roles/${roleId}`);
  },
};
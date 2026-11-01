import { api } from './api';

export interface Workspace {
  id: string;
  code: string;
  name: string;
  country_code: string;
  currency: string;
  timezone: string;
  is_default: boolean;
  access_level: string;
  is_active: boolean;
}

export const workspaceService = {
  async list(): Promise<Workspace[]> {
    const { data } = await api.get<Workspace[]>('/auth/workspaces');
    return data;
  },
};

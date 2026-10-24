import { api } from './api';

export type OrganisationType =
  | 'government'
  | 'ngo'
  | 'corporate'
  | 'school'
  | 'community'
  | 'other';

export interface Organisation {
  id: string;
  name: string;
  type: OrganisationType | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrganisationStats {
  total: number;
  by_type: Record<string, number>;
  total_contacts: number;
  total_opportunities: number;
}

export interface OrganisationListResponse {
  items: Organisation[];
  total: number;
}

export interface OrganisationCreatePayload {
  name: string;
  type?: OrganisationType;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  description?: string;
}

export interface OrganisationListParams {
  search?: string;
  type?: OrganisationType;
  limit?: number;
  offset?: number;
}

export const organisationService = {
  async list(params?: OrganisationListParams): Promise<OrganisationListResponse> {
    const { data } = await api.get<Organisation[]>('/organisation/', { params });
    // Backend returns a raw array — wrap it into a response shape
    return { items: data, total: data.length };
  },

  async getById(id: string): Promise<Organisation> {
    const { data } = await api.get<Organisation>(`/organisation/${id}`);
    return data;
  },

  async create(payload: OrganisationCreatePayload): Promise<Organisation> {
    const { data } = await api.post<Organisation>('/organisation', payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<OrganisationCreatePayload>,
  ): Promise<Organisation> {
    const { data } = await api.patch<Organisation>(`/organisation/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/organisation/${id}`);
  },
};
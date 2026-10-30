import { api } from './api';

export type DeviceCategory =
  | 'laptop'
  | 'monitor'
  | 'phone'
  | 'sim_card'
  | 'tablet'
  | 'peripheral'
  | 'other';

export type DeviceRequestStatus =
  | 'draft'
  | 'pending_manager'
  | 'pending_hr'
  | 'pending_fulfilment'
  | 'purchase_requested'
  | 'fulfilled'
  | 'rejected'
  | 'cancelled';

export interface DeviceRequestRecord {
  id: string;
  request_number: string;
  requester_id: string;
  requester_name: string;
  category: DeviceCategory | string;
  item_name: string;
  justification: string | null;
  needed_by: string | null;
  status: DeviceRequestStatus | string;
  current_stage: string | null;
  fulfilment: 'stock' | 'purchase' | null;
  device_id: string | null;
  device_name: string | null;
  assigned_at: string | null;
  purchase_reference: string | null;
  rejection_reason: string | null;
  manager_decision_note: string | null;
  hr_decision_note: string | null;
  submitted_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceRequestDecisionRecord {
  id: string;
  stage: string;
  status: string;
  decision: string;
  decided_by_name: string | null;
  decided_at: string | null;
  note: string | null;
}

export interface DeviceRequestDetail extends DeviceRequestRecord {
  approval_history: DeviceRequestDecisionRecord[];
}

export interface DeviceStockItem {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  condition: string;
}

export interface DeviceRequestInput {
  category: DeviceCategory;
  item_name: string;
  justification?: string;
  needed_by?: string;
}

export const deviceRequestService = {
  async listMine(): Promise<DeviceRequestRecord[]> {
    const { data } = await api.get<DeviceRequestRecord[]>(
      '/me/device-requests'
    );
    return data;
  },

  async getMine(id: string): Promise<DeviceRequestDetail> {
    const { data } = await api.get<DeviceRequestDetail>(
      `/me/device-requests/${id}`
    );
    return data;
  },

  async create(payload: DeviceRequestInput): Promise<DeviceRequestRecord> {
    const { data } = await api.post<DeviceRequestRecord>(
      '/me/device-requests',
      payload
    );
    return data;
  },

  async update(
    id: string,
    payload: Partial<DeviceRequestInput>
  ): Promise<DeviceRequestRecord> {
    const { data } = await api.patch<DeviceRequestRecord>(
      `/me/device-requests/${id}`,
      payload
    );
    return data;
  },

  async submit(id: string): Promise<DeviceRequestRecord> {
    const { data } = await api.post<DeviceRequestRecord>(
      `/me/device-requests/${id}/submit`
    );
    return data;
  },

  async cancel(id: string): Promise<DeviceRequestRecord> {
    const { data } = await api.post<DeviceRequestRecord>(
      `/me/device-requests/${id}/cancel`
    );
    return data;
  },

  async listAll(params?: {
    status?: string;
    stage?: string;
  }): Promise<DeviceRequestRecord[]> {
    const { data } = await api.get<DeviceRequestRecord[]>(
      '/hr/device-requests',
      { params }
    );
    return data;
  },

  async get(id: string): Promise<DeviceRequestDetail> {
    const { data } = await api.get<DeviceRequestDetail>(
      `/hr/device-requests/${id}`
    );
    return data;
  },

  async stock(): Promise<DeviceStockItem[]> {
    const { data } = await api.get<DeviceStockItem[]>(
      '/hr/device-requests/stock'
    );
    return data;
  },

  async assign(
    id: string,
    payload: { device_id: string; note?: string }
  ): Promise<DeviceRequestRecord> {
    const { data } = await api.post<DeviceRequestRecord>(
      `/hr/device-requests/${id}/fulfil/assign`,
      payload
    );
    return data;
  },

  async recordPurchase(
    id: string,
    payload: { purchase_reference?: string; note?: string }
  ): Promise<DeviceRequestRecord> {
    const { data } = await api.post<DeviceRequestRecord>(
      `/hr/device-requests/${id}/fulfil/purchase`,
      payload
    );
    return data;
  },
};

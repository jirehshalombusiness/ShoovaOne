import { api } from '../../services/api';

import type {
  Allocation,
  AllocationApprovalPayload,
  AllocationClosurePayload,
  AllocationListParams,
  AllocationSubmissionPayload,
  CreateAllocationPayload,
  UpdateAllocationPayload,
} from './allocation.types';

export const allocationService = {
  async getAllocations(
    params?: AllocationListParams,
  ): Promise<Allocation[]> {
    const response = await api.get<Allocation[]>(
      '/finance/allocations',
      {
        params,
      },
    );

    return response.data;
  },

  async getAllocation(
    allocationId: string,
  ): Promise<Allocation> {
    const response = await api.get<Allocation>(
      `/finance/allocations/${allocationId}`,
    );

    return response.data;
  },

  async createAllocation(
    payload: CreateAllocationPayload,
  ): Promise<Allocation> {
    const response = await api.post<Allocation>(
      '/finance/allocations',
      payload,
    );

    return response.data;
  },

  async updateAllocation(
    allocationId: string,
    payload: UpdateAllocationPayload,
  ): Promise<Allocation> {
    const response = await api.patch<Allocation>(
      `/finance/allocations/${allocationId}`,
      payload,
    );

    return response.data;
  },

  async submitAllocation(
    allocationId: string,
    payload?: AllocationSubmissionPayload,
  ): Promise<Allocation> {
    const response = await api.post<Allocation>(
      `/finance/allocations/${allocationId}/submit`,
      payload ?? {},
    );

    return response.data;
  },

  async approveAllocation(
    allocationId: string,
    payload?: AllocationApprovalPayload,
  ): Promise<Allocation> {
    const response = await api.post<Allocation>(
      `/finance/allocations/${allocationId}/approve`,
      payload ?? {},
    );

    return response.data;
  },

  async activateAllocation(
    allocationId: string,
  ): Promise<Allocation> {
    const response = await api.post<Allocation>(
      `/finance/allocations/${allocationId}/activate`,
    );

    return response.data;
  },

  async closeAllocation(
    allocationId: string,
    payload: AllocationClosurePayload,
  ): Promise<Allocation> {
    const response = await api.post<Allocation>(
      `/finance/allocations/${allocationId}/close`,
      payload,
    );

    return response.data;
  },
};
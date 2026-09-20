import { api } from '../../services/api';

import type {
  FinanceOverview,
  FundRequest,
  FundRequestListParams,
} from './finance.types';

export interface CreateFundRequestPayload {
  title: string;
  description?: string;
  justification?: string;
  project_id?: string;
  programme_id?: string;
  department_id?: string;
  amount_requested: number;
  currency: string;
  required_by_date?: string;
}

export const financeService = {
  async getOverview(): Promise<FinanceOverview> {
    const response = await api.get<FinanceOverview>(
      '/finance/overview'
    );

    return response.data;
  },

  async getFundRequests(
    params?: FundRequestListParams
  ): Promise<FundRequest[]> {
    const response = await api.get<FundRequest[]>(
      '/finance/fund-requests',
      {
        params,
      }
    );

    return response.data;
  },

  async getFundRequest(
    requestId: string
  ): Promise<FundRequest> {
    const response = await api.get<FundRequest>(
      `/finance/fund-requests/${requestId}`
    );

    return response.data;
  },

  async createFundRequest(
    payload: CreateFundRequestPayload
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      '/finance/fund-requests',
      payload
    );

    return response.data;
  },

  async submitFundRequest(
    requestId: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/submit`
    );

    return response.data;
  },

  async reviewFundRequest(
    requestId: string,
    reviewNotes?: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/review`,
      null,
      {
        params: {
          review_notes: reviewNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async approveFundRequest(
    requestId: string,
    approvedAmount?: number,
    approvalNotes?: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/approve`,
      null,
      {
        params: {
          approved_amount: approvedAmount,
          approval_notes: approvalNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async rejectFundRequest(
    requestId: string,
    rejectionReason: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/reject`,
      null,
      {
        params: {
          rejection_reason: rejectionReason,
        },
      }
    );

    return response.data;
  },

  async disburseFundRequest(
    requestId: string,
    amountDisbursed: number,
    disbursementNotes?: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/disburse`,
      null,
      {
        params: {
          amount_disbursed: amountDisbursed,
          disbursement_notes:
            disbursementNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async reconcileFundRequest(
    requestId: string,
    reconciliationNotes?: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/reconcile`,
      null,
      {
        params: {
          reconciliation_notes:
            reconciliationNotes || undefined,
        },
      }
    );

    return response.data;
  },
};
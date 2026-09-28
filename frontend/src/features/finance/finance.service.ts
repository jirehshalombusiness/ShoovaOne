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

export interface FundRequestReviewPayload {
  review_notes?: string;
}

export interface FundRequestApprovalPayload {
  approved_amount?: number;
  approval_notes?: string;
}

export interface FundRequestRejectionPayload {
  rejection_reason: string;
}

export interface FundRequestDisbursementPayload {
  amount_disbursed: number;
  disbursement_notes?: string;
}

export interface FundRequestReconciliationPayload {
  reconciliation_notes?: string;
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
    const payload: FundRequestReviewPayload = {
      review_notes: reviewNotes?.trim() || undefined,
    };

    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/review`,
      payload
    );

    return response.data;
  },

  async approveFundRequest(
    requestId: string,
    approvedAmount?: number,
    approvalNotes?: string
  ): Promise<FundRequest> {
    const payload: FundRequestApprovalPayload = {
      approved_amount: approvedAmount,
      approval_notes:
        approvalNotes?.trim() || undefined,
    };

    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/approve`,
      payload
    );

    return response.data;
  },

  async rejectFundRequest(
    requestId: string,
    rejectionReason: string
  ): Promise<FundRequest> {
    const payload: FundRequestRejectionPayload = {
      rejection_reason: rejectionReason.trim(),
    };

    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/reject`,
      payload
    );

    return response.data;
  },

  async disburseFundRequest(
    requestId: string,
    amountDisbursed: number,
    disbursementNotes?: string
  ): Promise<FundRequest> {
    const payload: FundRequestDisbursementPayload = {
      amount_disbursed: amountDisbursed,
      disbursement_notes:
        disbursementNotes?.trim() || undefined,
    };

    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/disburse`,
      payload
    );

    return response.data;
  },

  async reconcileFundRequest(
    requestId: string,
    reconciliationNotes?: string
  ): Promise<FundRequest> {
    const payload: FundRequestReconciliationPayload = {
      reconciliation_notes:
        reconciliationNotes?.trim() || undefined,
    };

    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/reconcile`,
      payload
    );

    return response.data;
  },
};
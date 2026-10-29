import { api } from '../../services/api';

import type {
  FinanceOverview,
  FundRequest,
  FundRequestDetail,
  FundRequestListParams,
  FundRequestReceiptVerificationPayload,
  FundRequestStatus,
  FundRequestType,
} from './finance.types';

export interface FundRequestPayload {
  request_type: FundRequestType;
  title: string;
  description?: string;
  justification?: string;
  expense_date?: string;
  project_id?: string;
  programme_id?: string;
  department_id?: string;
  amount_requested: number;
  currency: string;
  required_by_date?: string;
}

export type CreateFundRequestPayload = FundRequestPayload;

export type UpdateFundRequestPayload = Partial<FundRequestPayload>;

export const financeService = {
  async getOverview(): Promise<FinanceOverview> {
    const response = await api.get<FinanceOverview>(
      '/finance/overview'
    );

    return response.data;
  },

  // ========================================================
  // FINANCE QUEUE (permission-gated)
  // ========================================================

  async listFundRequests(
    params?: FundRequestListParams
  ): Promise<FundRequest[]> {
    const response = await api.get<FundRequest[]>(
      '/finance/fund-requests',
      { params }
    );

    return response.data;
  },

  async getFundRequest(
    requestId: string
  ): Promise<FundRequestDetail> {
    const response = await api.get<FundRequestDetail>(
      `/finance/fund-requests/${requestId}`
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
      {
        amount_disbursed: amountDisbursed,
        disbursement_notes:
          disbursementNotes?.trim() || undefined,
      }
    );

    return response.data;
  },

  async verifyFundRequestReceipt(
    requestId: string,
    payload: FundRequestReceiptVerificationPayload
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/fund-requests/${requestId}/verify-receipt`,
      {
        verified: payload.verified,
        note: payload.note?.trim() || undefined,
        receipt_reference:
          payload.receipt_reference?.trim() || undefined,
      }
    );

    return response.data;
  },

  // ========================================================
  // SELF-SERVICE (every authenticated employee)
  // ========================================================

  async listMyFundRequests(params?: {
    status?: FundRequestStatus;
    limit?: number;
    offset?: number;
  }): Promise<FundRequest[]> {
    const response = await api.get<FundRequest[]>(
      '/finance/me/fund-requests',
      { params }
    );

    return response.data;
  },

  async getMyFundRequest(
    requestId: string
  ): Promise<FundRequestDetail> {
    const response = await api.get<FundRequestDetail>(
      `/finance/me/fund-requests/${requestId}`
    );

    return response.data;
  },

  async createMyFundRequest(
    payload: CreateFundRequestPayload
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      '/finance/me/fund-requests',
      payload
    );

    return response.data;
  },

  async updateMyFundRequest(
    requestId: string,
    payload: UpdateFundRequestPayload
  ): Promise<FundRequest> {
    const response = await api.patch<FundRequest>(
      `/finance/me/fund-requests/${requestId}`,
      payload
    );

    return response.data;
  },

  async submitMyFundRequest(
    requestId: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/me/fund-requests/${requestId}/submit`
    );

    return response.data;
  },

  async cancelMyFundRequest(
    requestId: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/me/fund-requests/${requestId}/cancel`
    );

    return response.data;
  },

  async resubmitMyReceipt(
    requestId: string,
    note?: string
  ): Promise<FundRequest> {
    const response = await api.post<FundRequest>(
      `/finance/me/fund-requests/${requestId}/resubmit-receipt`,
      null,
      {
        params: note?.trim()
          ? { note: note.trim() }
          : undefined,
      }
    );

    return response.data;
  },
};

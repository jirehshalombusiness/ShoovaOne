import { api } from '../../services/api';

import type {
  CreateReimbursementPayload,
  Reimbursement,
  ReimbursementListParams,
} from './reimbursement.types';

export const reimbursementService = {
  async getReimbursements(
    params?: ReimbursementListParams
  ): Promise<Reimbursement[]> {
    const response = await api.get<Reimbursement[]>(
      '/finance/reimbursements',
      {
        params,
      }
    );

    return response.data;
  },

  async getReimbursement(
    reimbursementId: string
  ): Promise<Reimbursement> {
    const response = await api.get<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}`
    );

    return response.data;
  },

  async createReimbursement(
    payload: CreateReimbursementPayload
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      '/finance/reimbursements',
      payload
    );

    return response.data;
  },

  async updateReimbursement(
    reimbursementId: string,
    payload: Partial<CreateReimbursementPayload>
  ): Promise<Reimbursement> {
    const response = await api.patch<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}`,
      payload
    );

    return response.data;
  },

  async submitReimbursement(
    reimbursementId: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/submit`
    );

    return response.data;
  },

  async reviewReimbursement(
    reimbursementId: string,
    reviewNotes?: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/review`,
      {
        review_notes: reviewNotes || undefined,
      }
    );

    return response.data;
  },

  async approveReimbursement(
    reimbursementId: string,
    approvalNotes?: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/approve`,
      {
        approval_notes: approvalNotes || undefined,
      }
    );

    return response.data;
  },

  async rejectReimbursement(
    reimbursementId: string,
    rejectionReason: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/reject`,
      {
        rejection_reason: rejectionReason,
      }
    );

    return response.data;
  },

  async payReimbursement(
    reimbursementId: string,
    paymentNotes?: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/pay`,
      {
        payment_notes: paymentNotes || undefined,
      }
    );

    return response.data;
  },

  async reconcileReimbursement(
    reimbursementId: string,
    reconciliationNotes?: string
  ): Promise<Reimbursement> {
    const response = await api.post<Reimbursement>(
      `/finance/reimbursements/${reimbursementId}/reconcile`,
      {
        reconciliation_notes:
          reconciliationNotes || undefined,
      }
    );

    return response.data;
  },
};
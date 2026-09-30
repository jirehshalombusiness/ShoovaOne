import { api } from '../../services/api';

import type {
  CreateInvoicePayload,
  Invoice,
  InvoiceListParams,
  UpdateInvoicePayload,
} from './invoice.types';

export const invoiceService = {
  async getInvoices(
    params?: InvoiceListParams
  ): Promise<Invoice[]> {
    const response = await api.get<Invoice[]>(
      '/finance/invoices',
      {
        params,
      }
    );

    return response.data;
  },

  async getInvoice(
    invoiceId: string
  ): Promise<Invoice> {
    const response = await api.get<Invoice>(
      `/finance/invoices/${invoiceId}`
    );

    return response.data;
  },

  async createInvoice(
    payload: CreateInvoicePayload
  ): Promise<Invoice> {
    const response = await api.post<Invoice>(
      '/finance/invoices',
      payload
    );

    return response.data;
  },

  async updateInvoice(
    invoiceId: string,
    payload: UpdateInvoicePayload
  ): Promise<Invoice> {
    const response = await api.patch<Invoice>(
      `/finance/invoices/${invoiceId}`,
      payload
    );

    return response.data;
  },

  async issueInvoice(
    invoiceId: string
  ): Promise<Invoice> {
    const response = await api.post<Invoice>(
      `/finance/invoices/${invoiceId}/issue`
    );

    return response.data;
  },

  async cancelInvoice(
    invoiceId: string,
    cancellationReason: string
  ): Promise<Invoice> {
    const response = await api.post<Invoice>(
      `/finance/invoices/${invoiceId}/cancel`,
      {
        cancellation_reason: cancellationReason,
      }
    );

    return response.data;
  },
};
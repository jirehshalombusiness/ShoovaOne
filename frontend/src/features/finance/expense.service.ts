import { api } from '../../services/api';

import type {
  CreateExpensePayload,
  Expense,
  ExpenseListParams,
} from './expense.types';

export const expenseService = {
  async getExpenses(params?: ExpenseListParams): Promise<Expense[]> {
    const response = await api.get<Expense[]>('/finance/expenses', {
      params,
    });

    return response.data;
  },

  async getExpense(expenseId: string): Promise<Expense> {
    const response = await api.get<Expense>(
      `/finance/expenses/${expenseId}`
    );

    return response.data;
  },

  async createExpense(
    payload: CreateExpensePayload
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      '/finance/expenses',
      payload
    );

    return response.data;
  },

  async updateExpense(
    expenseId: string,
    payload: Partial<CreateExpensePayload>
  ): Promise<Expense> {
    const response = await api.patch<Expense>(
      `/finance/expenses/${expenseId}`,
      payload
    );

    return response.data;
  },

  async submitExpense(expenseId: string): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/submit`
    );

    return response.data;
  },

  async reviewExpense(
    expenseId: string,
    reviewNotes?: string
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/review`,
      null,
      {
        params: {
          review_notes: reviewNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async approveExpense(
    expenseId: string,
    approvalNotes?: string
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/approve`,
      null,
      {
        params: {
          approval_notes: approvalNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async rejectExpense(
    expenseId: string,
    rejectionReason: string
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/reject`,
      null,
      {
        params: {
          rejection_reason: rejectionReason,
        },
      }
    );

    return response.data;
  },

  async payExpense(
    expenseId: string,
    paymentNotes?: string
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/pay`,
      null,
      {
        params: {
          payment_notes: paymentNotes || undefined,
        },
      }
    );

    return response.data;
  },

  async reconcileExpense(
    expenseId: string,
    reconciliationNotes?: string
  ): Promise<Expense> {
    const response = await api.post<Expense>(
      `/finance/expenses/${expenseId}/reconcile`,
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
import { api } from '../../services/api';
import type {
  Budget,
  BudgetApprovalPayload,
  BudgetClosurePayload,
  BudgetListParams,
  BudgetSubmissionPayload,
  CreateBudgetPayload,
  UpdateBudgetPayload,
} from './budget.types';

export const budgetService = {
  async getBudgets(params?: BudgetListParams): Promise<Budget[]> {
    const response = await api.get<Budget[]>('/finance/budgets', {
      params,
    });

    return response.data;
  },

  async getBudget(budgetId: string): Promise<Budget> {
    const response = await api.get<Budget>(`/finance/budgets/${budgetId}`);

    return response.data;
  },

  async createBudget(payload: CreateBudgetPayload): Promise<Budget> {
    const response = await api.post<Budget>('/finance/budgets', payload);

    return response.data;
  },

  async updateBudget(
    budgetId: string,
    payload: UpdateBudgetPayload,
  ): Promise<Budget> {
    const response = await api.patch<Budget>(
      `/finance/budgets/${budgetId}`,
      payload,
    );

    return response.data;
  },

  async submitBudget(
    budgetId: string,
    payload?: BudgetSubmissionPayload,
  ): Promise<Budget> {
    const response = await api.post<Budget>(
      `/finance/budgets/${budgetId}/submit`,
      payload ?? {},
    );

    return response.data;
  },

  async approveBudget(
    budgetId: string,
    payload?: BudgetApprovalPayload,
  ): Promise<Budget> {
    const response = await api.post<Budget>(
      `/finance/budgets/${budgetId}/approve`,
      payload ?? {},
    );

    return response.data;
  },

  async activateBudget(budgetId: string): Promise<Budget> {
    const response = await api.post<Budget>(
      `/finance/budgets/${budgetId}/activate`,
    );

    return response.data;
  },

  async closeBudget(
    budgetId: string,
    payload: BudgetClosurePayload,
  ): Promise<Budget> {
    const response = await api.post<Budget>(
      `/finance/budgets/${budgetId}/close`,
      payload,
    );

    return response.data;
  },
};
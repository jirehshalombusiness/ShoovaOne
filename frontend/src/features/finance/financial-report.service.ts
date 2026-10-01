import { api } from '../../services/api';

import type {
  BudgetVsActualItem,
  CurrencySummaryResponse,
  FinancialReportFilters,
  FinancialSummary,
  FundFlowReport,
  IncomeExpenditureReport,
  ReceivableItem,
} from './financial-report.types';

function buildQueryParams(
  filters: FinancialReportFilters = {}
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.currency) {
    params.set('currency', filters.currency);
  }

  if (filters.start_date) {
    params.set('start_date', filters.start_date);
  }

  if (filters.end_date) {
    params.set('end_date', filters.end_date);
  }

  if (filters.fiscal_year) {
    params.set('fiscal_year', filters.fiscal_year);
  }

  if (typeof filters.include_paid === 'boolean') {
    params.set(
      'include_paid',
      String(filters.include_paid)
    );
  }

  return params;
}

function withQuery(
  path: string,
  filters?: FinancialReportFilters
): string {
  const params = buildQueryParams(filters);

  const query = params.toString();

  return query ? `${path}?${query}` : path;
}

export const financialReportService = {
  async getSummary(
    filters?: FinancialReportFilters
  ): Promise<FinancialSummary> {
    const response = await api.get<FinancialSummary>(
      withQuery('/finance/reports/summary', filters)
    );

    return response.data;
  },

  async getBudgetVsActual(
    filters?: FinancialReportFilters
  ): Promise<BudgetVsActualItem[]> {
    const response = await api.get<BudgetVsActualItem[]>(
      withQuery(
        '/finance/reports/budget-vs-actual',
        filters
      )
    );

    return response.data;
  },

  async getIncomeExpenditure(
    filters?: FinancialReportFilters
  ): Promise<IncomeExpenditureReport> {
    const response = await api.get<IncomeExpenditureReport>(
      withQuery(
        '/finance/reports/income-expenditure',
        filters
      )
    );

    return response.data;
  },

  async getReceivables(
    filters?: FinancialReportFilters
  ): Promise<ReceivableItem[]> {
    const response = await api.get<ReceivableItem[]>(
      withQuery(
        '/finance/reports/receivables',
        filters
      )
    );

    return response.data;
  },

  async getFundFlow(
    filters?: FinancialReportFilters
  ): Promise<FundFlowReport> {
    const response = await api.get<FundFlowReport>(
      withQuery(
        '/finance/reports/fund-flow',
        filters
      )
    );

    return response.data;
  },

  async getCurrencies(): Promise<CurrencySummaryResponse> {
    const response =
      await api.get<CurrencySummaryResponse>(
        '/finance/reports/currencies'
      );

    return response.data;
  },
};
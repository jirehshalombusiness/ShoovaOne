import { api } from '@/services/api';
import type {
  ComponentType,
  DepartmentCostReport,
  DisbursementBatch,
  EmployeeBankAccount,
  GLEntry,
  Loan,
  MyPayProfile,
  PayGroup,
  PayPeriod,
  PayProfile,
  PayRun,
  PayRunDetail,
  PayrollOverview,
  PayrollSummaryReport,
  Payslip,
  RecurringComponent,
  Remittance,
  StatutoryReport,
  StatutoryScheme,
  TaxBand,
} from './payroll.types';

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const payrollService = {
  // ----------------------------------------------------------
  // CONFIGURATION
  // ----------------------------------------------------------
  async getPayPeriods(params?: { frequency?: string; status?: string }): Promise<PayPeriod[]> {
    const { data } = await api.get<PayPeriod[]>('/payroll/pay-periods', { params });
    return data;
  },

  async createPayPeriod(payload: {
    name: string;
    frequency: string;
    period_start: string;
    period_end: string;
    cutoff_at?: string;
    pay_date: string;
    notes?: string;
  }): Promise<PayPeriod> {
    const { data } = await api.post<PayPeriod>('/payroll/pay-periods', payload);
    return data;
  },

  async generatePayPeriods(payload: {
    frequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';
    start_date: string;
    end_date: string;
    pay_day_offset?: number;
    cutoff_days_before_end?: number;
  }): Promise<PayPeriod[]> {
    const { data } = await api.post<PayPeriod[]>('/payroll/pay-periods/generate', payload);
    return data;
  },

  async updatePayPeriod(
    id: string,
    payload: { name?: string; cutoff_at?: string; pay_date?: string; status?: string; notes?: string },
  ): Promise<PayPeriod> {
    const { data } = await api.patch<PayPeriod>(`/payroll/pay-periods/${id}`, payload);
    return data;
  },

  async getPayGroups(activeOnly = true): Promise<PayGroup[]> {
    const { data } = await api.get<PayGroup[]>('/payroll/pay-groups', {
      params: { active_only: activeOnly },
    });
    return data;
  },

  async createPayGroup(payload: {
    name: string;
    description?: string;
    pay_type?: string;
    currency?: string;
    overtime_eligible?: boolean;
    proration_basis?: string;
  }): Promise<PayGroup> {
    const { data } = await api.post<PayGroup>('/payroll/pay-groups', payload);
    return data;
  },

  async getStatutorySchemes(includeInactive = false): Promise<StatutoryScheme[]> {
    const { data } = await api.get<StatutoryScheme[]>('/payroll/statutory-schemes', {
      params: { include_inactive: includeInactive },
    });
    return data;
  },

  async createStatutoryScheme(payload: {
    name: string;
    code: string;
    jurisdiction?: string;
    scheme_type?: string;
    employee_rate?: number;
    employer_rate?: number;
    base?: string;
    cap?: number | null;
    relief_amount?: number;
    remittance_due_day?: number | null;
    priority?: number;
    effective_from: string;
    effective_to?: string | null;
    notes?: string;
    bands?: TaxBand[];
  }): Promise<StatutoryScheme> {
    const { data } = await api.post<StatutoryScheme>('/payroll/statutory-schemes', payload);
    return data;
  },

  async updateStatutoryScheme(
    id: string,
    payload: {
      name?: string;
      remittance_due_day?: number | null;
      effective_to?: string | null;
      is_active?: boolean;
      notes?: string;
    },
  ): Promise<StatutoryScheme> {
    const { data } = await api.patch<StatutoryScheme>(
      `/payroll/statutory-schemes/${id}`,
      payload,
    );
    return data;
  },

  async getComponentTypes(category?: string): Promise<ComponentType[]> {
    const { data } = await api.get<ComponentType[]>('/payroll/component-types', {
      params: category ? { category } : undefined,
    });
    return data;
  },

  async createComponentType(payload: {
    code: string;
    name: string;
    category: string;
    taxable?: boolean;
    statutory?: boolean;
    calculation?: string;
    default_amount?: number;
    default_rate?: number;
    calculation_base?: string;
    priority?: number;
    gl_account?: string;
    notes?: string;
  }): Promise<ComponentType> {
    const { data } = await api.post<ComponentType>('/payroll/component-types', payload);
    return data;
  },

  // ----------------------------------------------------------
  // EMPLOYEE PAY SETUP
  // ----------------------------------------------------------
  async getProfiles(params?: {
    search?: string;
    pay_group_id?: string;
    active_only?: boolean;
  }): Promise<PayProfile[]> {
    const { data } = await api.get<PayProfile[]>('/payroll/profiles', { params });
    return data;
  },

  async getProfile(personId: string): Promise<PayProfile> {
    const { data } = await api.get<PayProfile>(`/payroll/profiles/${personId}`);
    return data;
  },

  async upsertProfile(payload: {
    person_id: string;
    pay_group_id?: string | null;
    pay_type?: string;
    base_amount?: number;
    hourly_rate?: number;
    currency?: string;
    overtime_multiplier?: number;
    payment_method?: string;
    cost_center?: string;
    department?: string;
    effective_from: string;
    effective_to?: string | null;
    notes?: string;
  }): Promise<PayProfile> {
    const { data } = await api.post<PayProfile>('/payroll/profiles', payload);
    return data;
  },

  async deactivateProfile(id: string): Promise<PayProfile> {
    const { data } = await api.post<PayProfile>(`/payroll/profiles/${id}/deactivate`);
    return data;
  },

  async getBankAccounts(personId: string, includeInactive = false): Promise<EmployeeBankAccount[]> {
    const { data } = await api.get<EmployeeBankAccount[]>(
      `/payroll/people/${personId}/bank-accounts`,
      { params: { include_inactive: includeInactive } },
    );
    return data;
  },

  async createBankAccount(
    personId: string,
    payload: {
      bank_name: string;
      branch?: string;
      bank_code?: string;
      account_name: string;
      account_number: string;
      mobile_money_provider?: string;
      is_primary?: boolean;
      effective_from: string;
      effective_to?: string | null;
    },
  ): Promise<EmployeeBankAccount> {
    const { data } = await api.post<EmployeeBankAccount>(
      `/payroll/people/${personId}/bank-accounts`,
      payload,
    );
    return data;
  },

  async approveBankAccount(id: string, note?: string): Promise<EmployeeBankAccount> {
    const { data } = await api.post<EmployeeBankAccount>(
      `/payroll/bank-accounts/${id}/approve`,
      { note },
    );
    return data;
  },

  async rejectBankAccount(id: string, reason: string): Promise<EmployeeBankAccount> {
    const { data } = await api.post<EmployeeBankAccount>(
      `/payroll/bank-accounts/${id}/reject`,
      { reason },
    );
    return data;
  },

  async getRecurringComponents(personId: string): Promise<RecurringComponent[]> {
    const { data } = await api.get<RecurringComponent[]>(
      `/payroll/people/${personId}/recurring-components`,
    );
    return data;
  },

  async createRecurringComponent(
    personId: string,
    payload: {
      component_type_id: string;
      amount?: number;
      rate?: number;
      effective_from: string;
      effective_to?: string | null;
      remaining_amount?: number | null;
      notes?: string;
    },
  ): Promise<RecurringComponent> {
    const { data } = await api.post<RecurringComponent>(
      `/payroll/people/${personId}/recurring-components`,
      payload,
    );
    return data;
  },

  async deactivateRecurringComponent(id: string): Promise<RecurringComponent> {
    const { data } = await api.post<RecurringComponent>(
      `/payroll/recurring-components/${id}/deactivate`,
    );
    return data;
  },

  async getLoans(personId: string): Promise<Loan[]> {
    const { data } = await api.get<Loan[]>(`/payroll/people/${personId}/loans`);
    return data;
  },

  async createLoan(
    personId: string,
    payload: {
      principal: number;
      interest_rate?: number;
      installment_amount: number;
      term_months: number;
      start_date: string;
      notes?: string;
    },
  ): Promise<Loan> {
    const { data } = await api.post<Loan>(`/payroll/people/${personId}/loans`, payload);
    return data;
  },

  async approveLoan(id: string, note?: string): Promise<Loan> {
    const { data } = await api.post<Loan>(`/payroll/loans/${id}/approve`, { note });
    return data;
  },

  // ----------------------------------------------------------
  // PAY RUNS
  // ----------------------------------------------------------
  async getRuns(params?: {
    period_id?: string;
    pay_group_id?: string;
    status?: string;
  }): Promise<PayRun[]> {
    const { data } = await api.get<PayRun[]>('/payroll/runs', { params });
    return data;
  },

  async getRun(id: string): Promise<PayRunDetail> {
    const { data } = await api.get<PayRunDetail>(`/payroll/runs/${id}`);
    return data;
  },

  async createRun(payload: {
    period_id: string;
    pay_group_id: string;
    run_type?: string;
    notes?: string;
  }): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>('/payroll/runs', payload);
    return data;
  },

  async calculateRun(id: string): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>(`/payroll/runs/${id}/calculate`);
    return data;
  },

  async submitRun(id: string, note?: string): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>(`/payroll/runs/${id}/submit`, { note });
    return data;
  },

  async reviewRun(
    id: string,
    decision: 'approved' | 'returned',
    note?: string,
  ): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>(`/payroll/runs/${id}/review`, {
      decision,
      note,
    });
    return data;
  },

  async approveRun(id: string, note?: string): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>(`/payroll/runs/${id}/approve`, { note });
    return data;
  },

  async finalizeRun(id: string): Promise<PayRunDetail> {
    const { data } = await api.post<PayRunDetail>(`/payroll/runs/${id}/finalize`);
    return data;
  },

  async getRunGLEntries(id: string): Promise<GLEntry[]> {
    const { data } = await api.get<GLEntry[]>(`/payroll/runs/${id}/gl-entries`);
    return data;
  },

  async getRunRemittances(id: string): Promise<Remittance[]> {
    const { data } = await api.get<Remittance[]>(`/payroll/runs/${id}/remittances`);
    return data;
  },

  // ----------------------------------------------------------
  // REMITTANCES / PAYSLIPS
  // ----------------------------------------------------------
  async getRemittances(params?: { status?: string; run_id?: string }): Promise<Remittance[]> {
    const { data } = await api.get<Remittance[]>('/payroll/remittances', { params });
    return data;
  },

  async payRemittance(id: string, reference: string): Promise<Remittance> {
    const { data } = await api.post<Remittance>(`/payroll/remittances/${id}/pay`, {
      reference,
    });
    return data;
  },

  async getPayslips(params?: { person_id?: string; period_id?: string }): Promise<Payslip[]> {
    const { data } = await api.get<Payslip[]>('/payroll/payslips', { params });
    return data;
  },

  // ----------------------------------------------------------
  // DISBURSEMENTS
  // ----------------------------------------------------------
  async getDisbursements(params?: { status?: string; run_id?: string }): Promise<DisbursementBatch[]> {
    const { data } = await api.get<DisbursementBatch[]>('/payroll/disbursements', { params });
    return data;
  },

  async getDisbursement(id: string): Promise<DisbursementBatch> {
    const { data } = await api.get<DisbursementBatch>(`/payroll/disbursements/${id}`);
    return data;
  },

  async createDisbursement(payload: {
    run_id: string;
    method: string;
    pay_date?: string;
    notes?: string;
  }): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>('/payroll/disbursements', payload);
    return data;
  },

  async approveDisbursement(id: string, note?: string): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>(
      `/payroll/disbursements/${id}/approve`,
      { note },
    );
    return data;
  },

  async downloadBankFile(batch: DisbursementBatch): Promise<void> {
    const response = await api.get(`/payroll/disbursements/${batch.id}/bank-file`, {
      responseType: 'blob',
    });
    downloadBlob(
      response.data,
      batch.bank_file_reference || `${batch.batch_number}.csv`,
      'text/csv',
    );
  },

  async submitDisbursement(id: string): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>(
      `/payroll/disbursements/${id}/submit`,
    );
    return data;
  },

  async reconcileDisbursement(
    id: string,
    outcome: 'paid' | 'failed',
    payload?: { failure_reason?: string; provider_reference?: string },
  ): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>(
      `/payroll/disbursements/${id}/reconcile`,
      { outcome, ...payload },
    );
    return data;
  },

  async reconcileDisbursementItem(
    itemId: string,
    status: 'paid' | 'failed',
    payload?: { failure_reason?: string; provider_reference?: string },
  ): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>(
      `/payroll/disbursements/items/${itemId}/reconcile`,
      { status, ...payload },
    );
    return data;
  },

  async retryDisbursementItem(
    itemId: string,
    providerReference?: string,
  ): Promise<DisbursementBatch> {
    const { data } = await api.post<DisbursementBatch>(
      `/payroll/disbursements/items/${itemId}/retry`,
      { provider_reference: providerReference },
    );
    return data;
  },

  // ----------------------------------------------------------
  // REPORTS
  // ----------------------------------------------------------
  async getOverview(): Promise<PayrollOverview> {
    const { data } = await api.get<PayrollOverview>('/payroll/reports/overview');
    return data;
  },

  async getSummary(fromDate?: string, toDate?: string): Promise<PayrollSummaryReport> {
    const { data } = await api.get<PayrollSummaryReport>('/payroll/reports/summary', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return data;
  },

  async getStatutoryReport(status?: string): Promise<StatutoryReport> {
    const { data } = await api.get<StatutoryReport>('/payroll/reports/statutory', {
      params: status ? { status } : undefined,
    });
    return data;
  },

  async getDepartmentCost(runId: string): Promise<DepartmentCostReport> {
    const { data } = await api.get<DepartmentCostReport>(
      '/payroll/reports/department-cost',
      { params: { run_id: runId } },
    );
    return data;
  },

  // ----------------------------------------------------------
  // SELF SERVICE
  // ----------------------------------------------------------
  async getMyPayProfile(): Promise<MyPayProfile> {
    const { data } = await api.get<MyPayProfile>('/payroll/me/profile');
    return data;
  },

  async getMyPayslips(): Promise<Payslip[]> {
    const { data } = await api.get<Payslip[]>('/payroll/me/payslips');
    return data;
  },

  async getMyPayslip(id: string): Promise<Payslip> {
    const { data } = await api.get<Payslip>(`/payroll/me/payslips/${id}`);
    return data;
  },

  async markPayslipViewed(id: string): Promise<Payslip> {
    const { data } = await api.post<Payslip>(`/payroll/me/payslips/${id}/viewed`);
    return data;
  },
};

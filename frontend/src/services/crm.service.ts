import { api } from './api';

export type OpportunityStage =
  | 'discovery'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'committed'
  | 'won'
  | 'lost';

export type OpportunityType = 'grant' | 'partnership' | 'contract' | 'programme';

export type OpportunitySource =
  | 'inbound'
  | 'outbound'
  | 'referral'
  | 'event'
  | 'existing_relationship';

export type StrategicPriority = 'high' | 'medium' | 'low';
export type EligibilityCheck = 'yes' | 'no' | 'unknown';

export interface OrganisationBrief {
  id: string;
  name: string;
  type?: string | null;
  country?: string | null;
}

export interface PersonBrief {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  profile_image_url?: string | null;
}

export interface OpportunitySummary {
  id: string;
  title: string;
  type: OpportunityType;
  organisation: OrganisationBrief;
  primary_contact?: PersonBrief | null;
  owner: PersonBrief;
  amount?: number | null;
  currency: string;
  amount_base?: number | null;
  expected_close_date?: string | null;
  stage: OpportunityStage;
  probability: number;
  qualified: boolean;
  strategic_priority: StrategicPriority;
  source: OpportunitySource;
  created_at: string;
  updated_at?: string | null;
}

export interface OpportunityActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'site_visit' | 'note';
  occurred_at: string;
  summary: string;
  next_step?: string | null;
  author?: PersonBrief | null;
}

export interface OpportunityStageHistory {
  id: string;
  from_stage?: OpportunityStage | null;
  to_stage: OpportunityStage;
  changed_by?: PersonBrief | null;
  note?: string | null;
  changed_at: string;
}

export interface OpportunityContributor {
  id: string;
  person: PersonBrief;
  role: 'contributor' | 'advisor' | 'sponsor';
}

export interface OpportunityDetail extends OpportunitySummary {
  description?: string | null;
  contributors: OpportunityContributor[];
  amount_type: string;
  expected_start_date?: string | null;
  expected_duration_months?: number | null;
  decision_timeline?: string | null;
  referred_by?: PersonBrief | null;
  campaign?: string | null;
  alignment_notes?: string | null;
  programme_id?: string | null;
  competitors: string[];
  competitive_advantage?: string | null;
  known_risks?: string | null;
  eligibility_check: EligibilityCheck;
  required_documents: string[];
  compliance_notes?: string | null;
  qualified_by?: PersonBrief | null;
  qualified_at?: string | null;
  qualification_notes?: string | null;
  qualification_criteria: Record<string, boolean>;
  won_at?: string | null;
  won_by?: PersonBrief | null;
  lost_at?: string | null;
  lost_reason?: string | null;
  lost_notes?: string | null;
  attributed_to?: PersonBrief | null;
  activities: OpportunityActivity[];
  stage_history: OpportunityStageHistory[];
}

export interface OpportunityListResponse {
  items: OpportunitySummary[];
  total: number;
  open_count: number;
  open_value: number;
  by_stage: Record<string, { count: number; value: number }>;
}

export interface OpportunityListParams {
  search?: string;
  stage?: OpportunityStage;
  type?: OpportunityType;
  owner_id?: string;
  organisation_id?: string;
  priority?: StrategicPriority;
  qualified_only?: boolean;
  open_only?: boolean;
  limit?: number;
  offset?: number;
}

export interface OpportunityCreatePayload {
  title: string;
  type: OpportunityType;
  description?: string;
  organisation_id: string;
  primary_contact_id?: string;
  amount?: number;
  currency?: string;
  amount_type?: string;
  expected_close_date?: string;
  expected_start_date?: string;
  expected_duration_months?: number;
  decision_timeline?: string;
  source?: OpportunitySource;
  referred_by_id?: string;
  campaign?: string;
  owner_id: string;
  alignment_notes?: string;
  strategic_priority?: StrategicPriority;
  programme_id?: string;
  competitors?: string[];
  competitive_advantage?: string;
  known_risks?: string;
  eligibility_check?: EligibilityCheck;
  required_documents?: string[];
  compliance_notes?: string;
}

export interface OpportunityUpdatePayload extends Partial<OpportunityCreatePayload> {
  qualification_criteria?: Record<string, boolean>;
  qualification_notes?: string;
  attributed_to_id?: string;
}

export interface StageTransitionPayload {
  to_stage: OpportunityStage;
  note?: string;
  lost_reason?: string;
  lost_notes?: string;
  attributed_to_id?: string;
  qualification_criteria?: Record<string, boolean>;
}

export interface ActivityCreatePayload {
  type: 'call' | 'email' | 'meeting' | 'site_visit' | 'note';
  occurred_at?: string;
  summary: string;
  next_step?: string;
}

export interface ContributorCreatePayload {
  person_id: string;
  role?: 'contributor' | 'advisor' | 'sponsor';
}

export type CrmReportPeriod =
  | 'this_quarter'
  | 'this_year'
  | 'last_12_months'
  | 'all_time';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  rate_to_base: number;
}

export interface CurrencyRates {
  base_currency: string;
  currencies: CurrencyOption[];
  rates: Record<string, number>;
  source: 'live' | 'fallback';
  updated_at?: string | null;
}

export interface CrmReportSummary {
  open_count: number;
  open_value: number;
  weighted_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  lost_value: number;
  win_rate: number;
  avg_deal_size: number;
  avg_sales_cycle_days: number;
  overdue_count: number;
  overdue_value: number;
  stalled_count: number;
  unconverted_count: number;
  unconverted_currencies: string[];
}

export interface CrmStageMetric {
  stage: OpportunityStage;
  count: number;
  value: number;
  weighted_value: number;
}

export interface CrmBreakdown {
  open_count: number;
  open_value: number;
  weighted_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  win_rate: number;
  type?: OpportunityType;
  source?: OpportunitySource;
}

export interface CrmOwnerMetric {
  owner_id: string;
  owner_name: string;
  open_count: number;
  open_value: number;
  weighted_value: number;
  won_count: number;
  won_value: number;
  lost_count: number;
  win_rate: number;
}

export interface CrmMonthlyPoint {
  month: string;
  label: string;
  won_count: number;
  won_value: number;
  lost_count: number;
  created_count: number;
}

export interface CrmForecastBucket {
  count: number;
  value: number;
  weighted_value: number;
}

export interface CrmForecastMonth extends CrmForecastBucket {
  month: string;
  label: string;
}

export interface CrmReportOpportunity {
  id: string;
  title: string;
  organisation: string;
  owner: string;
  stage: OpportunityStage;
  probability: number;
  currency: string;
  amount?: number | null;
  amount_base: number;
  expected_close_date?: string | null;
}

export interface CrmAttentionItem extends CrmReportOpportunity {
  reasons: ('overdue' | 'stalled')[];
  overdue_days: number;
  days_since_activity: number;
  last_activity_at?: string | null;
}

export interface CrmReport {
  base_currency: string;
  fx: CurrencyRates;
  period: CrmReportPeriod;
  period_start?: string | null;
  filters: {
    owner_id?: string | null;
    type?: OpportunityType | null;
  };
  summary: CrmReportSummary;
  by_stage: CrmStageMetric[];
  by_type: CrmBreakdown[];
  by_source: CrmBreakdown[];
  by_owner: CrmOwnerMetric[];
  monthly: CrmMonthlyPoint[];
  forecast: {
    months: CrmForecastMonth[];
    overdue: CrmForecastBucket;
    later: CrmForecastBucket;
  };
  win_loss: {
    won_count: number;
    won_value: number;
    lost_count: number;
    lost_value: number;
    win_rate: number;
    lost_reasons: { reason: string; count: number; value: number }[];
  };
  top_opportunities: CrmReportOpportunity[];
  needs_attention: CrmAttentionItem[];
  owner_options: { id: string; name: string }[];
}

export interface CrmReportParams {
  period?: CrmReportPeriod;
  owner_id?: string;
  type?: OpportunityType;
}

export const crmService = {
  async listOpportunities(params?: OpportunityListParams): Promise<OpportunityListResponse> {
    const { data } = await api.get<OpportunityListResponse>('/crm/opportunities', { params });
    return data;
  },

  async getOpportunity(id: string): Promise<OpportunityDetail> {
    const { data } = await api.get<OpportunityDetail>(`/crm/opportunities/${id}`);
    return data;
  },

  async createOpportunity(payload: OpportunityCreatePayload): Promise<OpportunityDetail> {
    const { data } = await api.post<OpportunityDetail>('/crm/opportunities', payload);
    return data;
  },

  async updateOpportunity(
    id: string,
    payload: OpportunityUpdatePayload,
  ): Promise<OpportunityDetail> {
    const { data } = await api.patch<OpportunityDetail>(`/crm/opportunities/${id}`, payload);
    return data;
  },

  async transitionStage(
    id: string,
    payload: StageTransitionPayload,
  ): Promise<OpportunityDetail> {
    const { data } = await api.post<OpportunityDetail>(
      `/crm/opportunities/${id}/stage`,
      payload,
    );
    return data;
  },

  async addActivity(
    id: string,
    payload: ActivityCreatePayload,
  ): Promise<OpportunityDetail> {
    const { data } = await api.post<OpportunityDetail>(
      `/crm/opportunities/${id}/activities`,
      payload,
    );
    return data;
  },

  async deleteActivity(id: string, activityId: string): Promise<void> {
    await api.delete(`/crm/opportunities/${id}/activities/${activityId}`);
  },

  async addContributor(
    id: string,
    payload: ContributorCreatePayload,
  ): Promise<OpportunityDetail> {
    const { data } = await api.post<OpportunityDetail>(
      `/crm/opportunities/${id}/contributors`,
      payload,
    );
    return data;
  },

  async removeContributor(id: string, contributorId: string): Promise<void> {
    await api.delete(`/crm/opportunities/${id}/contributors/${contributorId}`);
  },

  async getCurrencyRates(): Promise<CurrencyRates> {
    const { data } = await api.get<CurrencyRates>('/crm/currency-rates');
    return data;
  },

  async getReport(params?: CrmReportParams): Promise<CrmReport> {
    const { data } = await api.get<CrmReport>('/crm/reports', { params });
    return data;
  },
};

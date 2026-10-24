import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  GitBranch,
  Building2,
  DollarSign,
  Target,
  ArrowRight,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { crmService, type OpportunitySummary } from '@/services/crm.service';
import { cn } from '@/lib/utils';

export function CrmOverviewPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'overview'],
    queryFn: () => crmService.listOpportunities({ limit: 500 }),
    refetchInterval: 5 * 60_000,
  });

  const opportunities = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Compute metrics
  const open = opportunities.filter(
    (o) => o.stage !== 'won' && o.stage !== 'lost',
  );
  const won = opportunities.filter((o) => o.stage === 'won');
  const lost = opportunities.filter((o) => o.stage === 'lost');
  const closed = [...won, ...lost];

  const openValue = open.reduce((s, o) => s + (o.amount_base || 0), 0);
  const weightedValue = open.reduce(
    (s, o) => s + ((o.amount_base || 0) * o.probability) / 100,
    0,
  );
  const wonValue = won.reduce((s, o) => s + (o.amount_base || 0), 0);

  const winRate =
    closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;

  const avgDealSize =
    won.length > 0 ? Math.round(wonValue / won.length) : 0;

  // Top open opportunities
  const topOpps = [...open]
    .sort((a, b) => (b.amount_base || 0) - (a.amount_base || 0))
    .slice(0, 5);

  // Recent wins
  const recentWins = [...won].slice(0, 3);

  // By stage
  const byStage: Record<string, { count: number; value: number }> = {
    discovery: { count: 0, value: 0 },
    qualified: { count: 0, value: 0 },
    proposal: { count: 0, value: 0 },
    negotiation: { count: 0, value: 0 },
    committed: { count: 0, value: 0 },
    won: { count: 0, value: 0 },
    lost: { count: 0, value: 0 },
  };
  for (const o of opportunities) {
    byStage[o.stage].count += 1;
    byStage[o.stage].value += o.amount_base || 0;
  }

  const stageLabels: Record<string, string> = {
    discovery: 'Discovery',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    committed: 'Committed',
    won: 'Won',
    lost: 'Lost',
  };

  const openStages = ['discovery', 'qualified', 'proposal', 'negotiation', 'committed'];
  const maxStageCount = Math.max(
    ...openStages.map((s) => byStage[s].count),
    1,
  );

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={GitBranch}
          label="Open Opportunities"
          value={open.length}
          sub="in active pipeline"
          tone="primary"
          onClick={() => navigate('/crm/pipeline')}
        />
        <KpiCard
          icon={DollarSign}
          label="Total Pipeline Value"
          value={`GHS ${openValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="across open opportunities"
          tone="info"
          onClick={() => navigate('/crm/pipeline')}
        />
        <KpiCard
          icon={TrendingUp}
          label="Weighted Forecast"
          value={`GHS ${weightedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="probability-adjusted"
          tone="success"
          onClick={() => navigate('/crm/pipeline')}
        />
        <KpiCard
          icon={Target}
          label="Win Rate"
          value={`${winRate}%`}
          sub={`${won.length} won · ${lost.length} lost`}
          tone={winRate >= 50 ? 'success' : winRate >= 25 ? 'warning' : 'danger'}
        />
      </div>

      {/* Main two-column area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline by stage */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-gray-900">
                Pipeline by Stage
              </h3>
            </div>
            <button
              onClick={() => navigate('/crm/pipeline')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View board
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {openStages.map((stage) => {
              const data = byStage[stage];
              const pct = maxStageCount > 0 ? (data.count / maxStageCount) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-gray-700 font-medium">
                      {stageLabels[stage]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-gray-900 tabular-nums">
                        {data.count}
                      </span>
                      {data.value > 0 && (
                        <span className="text-[10px] text-gray-400 tabular-nums">
                          GHS {data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Closed summary */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-50">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-emerald-900">
                  {won.length}
                </div>
                <div className="text-[10px] text-emerald-700">
                  won · GHS {wonValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-red-50">
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-red-900">
                  {lost.length}
                </div>
                <div className="text-[10px] text-red-700">lost</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top opportunities */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-gray-900">
                Top Open Opportunities
              </h3>
            </div>
            <button
              onClick={() => navigate('/crm/pipeline')}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {topOpps.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No open opportunities yet
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {topOpps.map((opp) => (
                <button
                  key={opp.id}
                  onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                  className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">
                      {opp.title}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {opp.organisation.name} · {opp.probability}% ·{' '}
                      {opp.stage}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] font-semibold text-gray-900 tabular-nums">
                      {opp.currency}{' '}
                      {(opp.amount || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    {opp.currency !== 'GHS' && opp.amount_base != null && (
                      <div className="text-[9px] text-gray-400 tabular-nums">
                        ≈ GHS{' '}
                        {opp.amount_base.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent wins */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-gray-900">
                Recent Wins
              </h3>
            </div>
          </div>

          {recentWins.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No wins yet</p>
              <p className="text-[11px] text-gray-400 mt-1">
                When opportunities close, they'll appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentWins.map((opp) => (
                <button
                  key={opp.id}
                  onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                  className="w-full flex items-start gap-3 p-3 rounded-md border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">
                      {opp.title}
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5">
                      {opp.organisation.name}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[13px] font-bold text-emerald-700 tabular-nums">
                      {opp.currency}{' '}
                      {(opp.amount || 0).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                    {opp.currency !== 'GHS' && opp.amount_base != null && (
                      <div className="text-[9px] text-emerald-600 tabular-nums">
                        ≈ GHS{' '}
                        {opp.amount_base.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-gray-900">At a glance</h3>
          </div>
          <div className="space-y-3">
            <StatRow label="Total opportunities" value={opportunities.length} />
            <StatRow
              label="Average won size"
              value={`GHS ${avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
            <StatRow label="Open opportunities" value={open.length} />
            <StatRow label="Closed opportunities" value={closed.length} />
            <StatRow
              label="Win rate"
              value={`${winRate}%`}
              tone={winRate >= 50 ? 'success' : 'default'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  tone: 'primary' | 'info' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const toneStyles = {
    primary: { icon: 'text-primary', value: 'text-gray-900' },
    info: { icon: 'text-blue-500', value: 'text-gray-900' },
    success: { icon: 'text-emerald-500', value: 'text-emerald-700' },
    warning: { icon: 'text-amber-500', value: 'text-amber-700' },
    danger: { icon: 'text-red-500', value: 'text-red-700' },
  }[tone];

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-lg p-5 text-left',
        onClick && 'hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn('w-4 h-4', toneStyles.icon)} strokeWidth={1.75} />
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', toneStyles.value)}>
        {value}
      </div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </button>
  );
}

function StatRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span
        className={cn(
          'text-[13px] font-semibold tabular-nums',
          tone === 'success' ? 'text-emerald-700' : 'text-gray-900',
        )}
      >
        {value}
      </span>
    </div>
  );
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Download,
  GitBranch,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  crmService,
  type CrmAttentionItem,
  type CrmReport,
  type CrmReportPeriod,
  type OpportunityType,
} from '@/services/crm.service';
import { cn } from '@/lib/utils';

const PERIODS: { value: CrmReportPeriod; label: string }[] = [
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'all_time', label: 'All time' },
];

const STAGE_META: Record<string, { label: string; bar: string; text: string }> = {
  discovery: { label: 'Discovery', bar: 'bg-gray-400', text: 'text-gray-700' },
  qualified: { label: 'Qualified', bar: 'bg-blue-500', text: 'text-blue-700' },
  proposal: { label: 'Proposal', bar: 'bg-indigo-500', text: 'text-indigo-700' },
  negotiation: { label: 'Negotiation', bar: 'bg-purple-500', text: 'text-purple-700' },
  committed: { label: 'Committed', bar: 'bg-amber-500', text: 'text-amber-700' },
  won: { label: 'Won', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  lost: { label: 'Lost', bar: 'bg-red-500', text: 'text-red-700' },
};

const TYPE_LABELS: Record<string, string> = {
  grant: 'Grant',
  partnership: 'Partnership',
  contract: 'Contract',
  programme: 'Programme',
};

const SOURCE_LABELS: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  referral: 'Referral',
  event: 'Event',
  existing_relationship: 'Existing relationship',
};

function money(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `GHS ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `GHS ${(value / 1_000).toFixed(1)}K`;
  }
  return `GHS ${Math.round(value).toLocaleString('en-GH')}`;
}

function percent(value: number): string {
  return `${Math.round(value)}%`;
}

function periodLabel(period: CrmReportPeriod | undefined): string {
  return PERIODS.find((item) => item.value === period)?.label ?? 'This year';
}

function exportReport(report: CrmReport) {
  const rows: (string | number)[][] = [
    ['CRM report', periodLabel(report.period)],
    ['Generated', new Date().toISOString()],
    ['Base currency', report.base_currency],
    ['FX source', report.fx.source],
    [],
    ['Summary', 'Value'],
    ['Open pipeline (GHS)', report.summary.open_value],
    ['Weighted forecast (GHS)', report.summary.weighted_value],
    ['Won value (GHS)', report.summary.won_value],
    ['Lost value (GHS)', report.summary.lost_value],
    ['Open opportunities', report.summary.open_count],
    ['Won opportunities', report.summary.won_count],
    ['Lost opportunities', report.summary.lost_count],
    ['Win rate (%)', report.summary.win_rate],
    ['Average deal size (GHS)', report.summary.avg_deal_size],
    ['Average sales cycle (days)', report.summary.avg_sales_cycle_days],
    ['Overdue opportunities', report.summary.overdue_count],
    ['Stalled opportunities', report.summary.stalled_count],
    [],
    ['Pipeline by stage', 'Count', 'Value (GHS)', 'Weighted (GHS)'],
    ...report.by_stage.map((row) => [
      STAGE_META[row.stage]?.label ?? row.stage,
      row.count,
      row.value,
      row.weighted_value,
    ]),
    [],
    ['Owner', 'Open deals', 'Open value (GHS)', 'Weighted (GHS)', 'Won value (GHS)', 'Win rate (%)'],
    ...report.by_owner.map((row) => [
      row.owner_name,
      row.open_count,
      row.open_value,
      row.weighted_value,
      row.won_value,
      row.win_rate,
    ]),
    [],
    ['Source', 'Open value (GHS)', 'Won value (GHS)', 'Win rate (%)'],
    ...report.by_source.map((row) => [
      SOURCE_LABELS[row.source ?? ''] ?? row.source ?? 'Unknown',
      row.open_value,
      row.won_value,
      row.win_rate,
    ]),
    [],
    ['Needs attention', 'Organisation', 'Owner', 'Stage', 'Overdue days', 'Days since activity', 'Reasons'],
    ...report.needs_attention.map((row) => [
      row.title,
      row.organisation,
      row.owner,
      STAGE_META[row.stage]?.label ?? row.stage,
      row.overdue_days,
      row.days_since_activity,
      row.reasons.join(' / '),
    ]),
  ];

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `crm-report-${report.period}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CrmReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<CrmReportPeriod>('this_year');
  const [typeFilter, setTypeFilter] = useState<OpportunityType | ''>('');
  const [ownerFilter, setOwnerFilter] = useState('');

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['crm', 'report', period, typeFilter, ownerFilter],
    queryFn: () =>
      crmService.getReport({
        period,
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(ownerFilter ? { owner_id: ownerFilter } : {}),
      }),
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="h-80 bg-gray-100 rounded-lg animate-pulse" />
          <div className="lg:col-span-2 h-80 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-gray-900">
          Could not load the CRM report
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Check your connection and try again.
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const { summary, win_loss, forecast, fx } = data;
  const maxStageValue = Math.max(
    ...data.by_stage.map((stage) => stage.value),
    1,
  );
  const maxMonthly = Math.max(
    ...data.monthly.map((month) => month.won_value),
    1,
  );
  const maxForecast = Math.max(
    ...forecast.months.map((month) => month.value),
    1,
  );

  const fxUpdatedAt = fx.updated_at ? new Date(fx.updated_at) : null;
  const fxUpdatedLabel =
    fxUpdatedAt && !Number.isNaN(fxUpdatedAt.getTime())
      ? format(fxUpdatedAt, 'MMM d, yyyy HH:mm')
      : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Pipeline health, conversion, revenue and forecast in one view.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as CrmReportPeriod)}
            className="px-3 py-2 border border-gray-200 rounded-md text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {PERIODS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OpportunityType | '')}
            className="px-3 py-2 border border-gray-200 rounded-md text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All types</option>
            <option value="grant">Grants</option>
            <option value="partnership">Partnerships</option>
            <option value="contract">Contracts</option>
            <option value="programme">Programmes</option>
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All owners</option>
            {data.owner_options.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => exportReport(data)}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-gray-200 rounded-md bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh report"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* FX note */}
      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              fx.source === 'live' ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {fx.source === 'live' ? 'Live FX rates' : 'Fallback FX rates'}
        </span>
        <span>
          All values standardised to GHS
          {fx.rates.USD ? ` · 1 USD = ${fx.rates.USD.toFixed(4)} GHS` : ''}
          {fxUpdatedLabel ? ` · updated ${fxUpdatedLabel}` : ''}
        </span>
        <span className="text-gray-400">
          Open pipeline is as of today; won/lost metrics cover {periodLabel(period).toLowerCase()}.
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={GitBranch}
          label="Open pipeline"
          value={money(summary.open_value, true)}
          sub={`${summary.open_count} opportunities · ${money(summary.weighted_value, true)} weighted`}
          iconClass="text-primary bg-primary/10"
        />
        <KpiCard
          icon={Trophy}
          label="Won in period"
          value={money(summary.won_value, true)}
          sub={`${summary.won_count} deals · ${money(summary.lost_value, true)} lost`}
          iconClass="text-emerald-700 bg-emerald-50"
        />
        <KpiCard
          icon={Target}
          label="Win rate"
          value={percent(summary.win_rate)}
          sub={`${win_loss.won_count} won · ${win_loss.lost_count} lost`}
          iconClass="text-blue-700 bg-blue-50"
        />
        <KpiCard
          icon={CalendarClock}
          label="Average sales cycle"
          value={`${summary.avg_sales_cycle_days || 0} days`}
          sub={`${money(summary.avg_deal_size, true)} average deal size`}
          iconClass="text-purple-700 bg-purple-50"
        />
      </div>

      {/* Secondary stats */}
      <div className="bg-white border border-gray-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-gray-100">
        <MiniStat label="Open opportunities" value={summary.open_count} />
        <MiniStat
          label="Overdue close dates"
          value={summary.overdue_count}
          sub={money(summary.overdue_value, true)}
          tone={summary.overdue_count > 0 ? 'danger' : 'default'}
        />
        <MiniStat
          label="Stalled · no activity"
          value={summary.stalled_count}
          sub="21+ days"
          tone={summary.stalled_count > 0 ? 'warning' : 'default'}
        />
        <MiniStat
          label="Unconverted values"
          value={summary.unconverted_count}
          sub={
            summary.unconverted_currencies.length > 0
              ? summary.unconverted_currencies.join(', ')
              : 'all currencies converted'
          }
        />
      </div>

      {/* Pipeline + revenue trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          icon={GitBranch}
          title="Pipeline by stage"
          subtitle="Current open book, GHS value"
        >
          <div className="space-y-4">
            {data.by_stage.map((stage) => {
              const meta = STAGE_META[stage.stage];
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12px] font-medium text-gray-700">
                      {meta?.label ?? stage.stage}
                    </span>
                    <span className="text-[11px] text-gray-500 tabular-nums">
                      {stage.count} · {money(stage.value, true)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', meta?.bar ?? 'bg-primary')}
                      style={{
                        width: `${Math.max(
                          (stage.value / maxStageValue) * 100,
                          stage.value > 0 ? 3 : 0,
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 tabular-nums">
                    Weighted {money(stage.weighted_value, true)}
                  </div>
                </div>
              );
            })}
            {data.by_stage.every((stage) => stage.count === 0) && (
              <EmptyState message="No open opportunities yet" />
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={TrendingUp}
          title="Won revenue trend"
          subtitle="Last 12 months, GHS value"
          className="lg:col-span-2"
          action={
            <span className="text-[11px] text-gray-500 tabular-nums">
              12-mo total {money(
                data.monthly.reduce((sum, month) => sum + month.won_value, 0),
                true,
              )}
            </span>
          }
        >
          <div className="flex items-end gap-1.5 h-48 pt-4">
            {data.monthly.map((month) => (
              <div
                key={month.month}
                className="flex-1 h-full flex flex-col items-center justify-end gap-1 group min-w-0"
                title={`${month.label}: ${money(month.won_value)} won · ${month.won_count} deals`}
              >
                <div className="text-[9px] font-medium text-gray-600 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                  {month.won_value > 0 ? money(month.won_value, true).replace('GHS ', '') : ''}
                </div>
                <div
                  className={cn(
                    'w-full max-w-[30px] rounded-t transition-all',
                    month.won_value > 0 ? 'bg-emerald-500' : 'bg-gray-100',
                  )}
                  style={{
                    height: `${Math.max(
                      (month.won_value / maxMonthly) * 100,
                      month.won_value > 0 ? 4 : 2,
                    )}%`,
                  }}
                />
                <span className="text-[9px] text-gray-400">{month.label}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Win/loss + forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          icon={BarChart3}
          title="Win / loss"
          subtitle={`${periodLabel(period)} closed outcomes`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5 items-center">
            <WinLossDonut won={win_loss.won_count} lost={win_loss.lost_count} />
            <div className="space-y-2 w-full">
              <OutcomeRow
                label="Won"
                count={win_loss.won_count}
                value={win_loss.won_value}
                dot="bg-emerald-500"
              />
              <OutcomeRow
                label="Lost"
                count={win_loss.lost_count}
                value={win_loss.lost_value}
                dot="bg-red-500"
              />
            </div>
          </div>
          {win_loss.lost_reasons.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Lost reasons
              </div>
              <div className="space-y-1.5">
                {win_loss.lost_reasons.slice(0, 4).map((reason) => (
                  <div
                    key={reason.reason}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-gray-600 capitalize truncate">
                      {reason.reason}
                    </span>
                    <span className="text-gray-900 font-medium tabular-nums">
                      {reason.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={CalendarClock}
          title="Forecast"
          subtitle="Open pipeline by expected close month"
          className="lg:col-span-2"
          action={
            forecast.overdue.count > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                <AlertTriangle className="w-3 h-3" />
                {forecast.overdue.count} overdue · {money(forecast.overdue.value, true)}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                No overdue closes
              </span>
            )
          }
        >
          <div className="space-y-3.5">
            {forecast.months.map((month) => (
              <div key={month.month}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[12px] font-medium text-gray-700">
                    {month.label}
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {month.count} · {money(month.value, true)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(
                        (month.value / maxForecast) * 100,
                        month.value > 0 ? 3 : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-md bg-red-50 px-3 py-2">
                <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wider">
                  Overdue
                </div>
                <div className="text-sm font-bold text-red-900 tabular-nums mt-0.5">
                  {money(forecast.overdue.value, true)}
                </div>
                <div className="text-[10px] text-red-600">
                  {forecast.overdue.count} deals past close date
                </div>
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  Later
                </div>
                <div className="text-sm font-bold text-gray-900 tabular-nums mt-0.5">
                  {money(forecast.later.value, true)}
                </div>
                <div className="text-[10px] text-gray-500">
                  {forecast.later.count} deals beyond 6 months
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Owner + source performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          icon={Users}
          title="Performance by owner"
          subtitle="Current pipeline and closed outcomes"
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="font-semibold pb-2 px-1">Owner</th>
                  <th className="font-semibold pb-2 px-1 text-right">Open</th>
                  <th className="font-semibold pb-2 px-1 text-right">Open value</th>
                  <th className="font-semibold pb-2 px-1 text-right">Weighted</th>
                  <th className="font-semibold pb-2 px-1 text-right">Won</th>
                  <th className="font-semibold pb-2 px-1 text-right">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {data.by_owner.map((owner) => (
                  <tr
                    key={owner.owner_id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="py-2.5 px-1">
                      <div className="font-medium text-gray-900">{owner.owner_name}</div>
                      <div className="text-[10px] text-gray-400">
                        {owner.won_count} won · {owner.lost_count} lost
                      </div>
                    </td>
                    <td className="py-2.5 px-1 text-right tabular-nums text-gray-600">
                      {owner.open_count}
                    </td>
                    <td className="py-2.5 px-1 text-right tabular-nums text-gray-900 font-medium">
                      {money(owner.open_value, true)}
                    </td>
                    <td className="py-2.5 px-1 text-right tabular-nums text-gray-500">
                      {money(owner.weighted_value, true)}
                    </td>
                    <td className="py-2.5 px-1 text-right tabular-nums text-emerald-700 font-medium">
                      {money(owner.won_value, true)}
                    </td>
                    <td className="py-2.5 px-1 text-right">
                      <span
                        className={cn(
                          'inline-flex min-w-[42px] justify-center rounded px-1.5 py-0.5 font-semibold tabular-nums',
                          owner.win_rate >= 50
                            ? 'bg-emerald-50 text-emerald-700'
                            : owner.win_rate >= 25
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {percent(owner.win_rate)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.by_owner.length === 0 && <EmptyState message="No owners with opportunities yet" />}
          </div>
        </SectionCard>

        <SectionCard
          icon={ArrowRight}
          title="Source performance"
          subtitle="Where opportunities come from"
        >
          <div className="space-y-3">
            {data.by_source.map((source) => (
              <div
                key={source.source ?? 'unknown'}
                className="rounded-md border border-gray-100 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-gray-800">
                    {SOURCE_LABELS[source.source ?? ''] ?? source.source ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500">
                    {percent(source.win_rate)} win
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                  <span>{source.open_count} open</span>
                  <span className="tabular-nums text-gray-900 font-medium">
                    {money(source.open_value, true)}
                  </span>
                </div>
                <div className="text-[10px] text-emerald-700 mt-0.5 tabular-nums">
                  Won {money(source.won_value, true)} · {source.won_count} deals
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              By type
            </div>
            <div className="space-y-1.5">
              {data.by_type.map((type) => (
                <div
                  key={type.type ?? 'unknown'}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="text-gray-700">
                    {TYPE_LABELS[type.type ?? ''] ?? type.type ?? 'Unknown'}
                  </span>
                  <span className="text-gray-500 tabular-nums">
                    {type.open_count} open ·{' '}
                    <span className="text-gray-900 font-medium">
                      {money(type.open_value, true)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Needs attention + top opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SectionCard
          icon={AlertTriangle}
          title="Needs attention"
          subtitle="Overdue close dates or 21+ days without activity"
          className="lg:col-span-2"
          action={
            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {data.needs_attention.length} shown
            </span>
          }
        >
          <div className="space-y-2">
            {data.needs_attention.map((item) => (
              <AttentionRow
                key={item.id}
                item={item}
                onClick={() => navigate(`/crm/opportunities/${item.id}`)}
              />
            ))}
            {data.needs_attention.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-4">
                <CheckCircle2 className="w-4 h-4" />
                Everything is on track — no overdue or stalled opportunities.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={Trophy}
          title="Top open opportunities"
          subtitle="Largest current pipeline value"
        >
          <div className="space-y-2">
            {data.top_opportunities.map((item, index) => (
              <button
                key={item.id}
                onClick={() => navigate(`/crm/opportunities/${item.id}`)}
                className="w-full flex items-start gap-2.5 p-2 rounded-md hover:bg-gray-50 transition-colors text-left group"
              >
                <span className="w-5 h-5 rounded bg-gray-100 text-[10px] font-bold text-gray-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-gray-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {item.organisation} · {item.owner}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[11px] font-semibold text-gray-900 tabular-nums">
                    {money(item.amount_base, true)}
                  </div>
                  <div className="text-[9px] text-gray-400 flex items-center justify-end gap-0.5">
                    {STAGE_META[item.stage]?.label ?? item.stage}
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              </button>
            ))}
            {data.top_opportunities.length === 0 && (
              <EmptyState message="No open opportunities yet" />
            )}
          </div>
        </SectionCard>
      </div>

      {summary.unconverted_count > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {summary.unconverted_count} opportunity value
          {summary.unconverted_count === 1 ? ' uses' : 's use'} an unsupported
          currency ({summary.unconverted_currencies.join(', ')}). These values
          are excluded from GHS totals.
        </div>
      )}
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
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  iconClass: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <span className={cn('w-8 h-8 rounded-md flex items-center justify-center', iconClass)}>
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'default' | 'danger' | 'warning';
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          'text-lg font-bold tabular-nums mt-0.5',
          tone === 'danger'
            ? 'text-red-700'
            : tone === 'warning'
              ? 'text-amber-700'
              : 'text-gray-900',
        )}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg p-5', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 text-gray-400 mt-0.5" strokeWidth={1.75} />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function WinLossDonut({ won, lost }: { won: number; lost: number }) {
  const total = won + lost;
  const winPct = total > 0 ? (won / total) * 100 : 0;

  return (
    <div className="relative w-36 h-36 mx-auto flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          className="text-gray-200"
          stroke="currentColor"
          strokeWidth="4"
        />
        {total > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            className="text-emerald-500"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${winPct} ${100 - winPct}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 tabular-nums">
          {Math.round(winPct)}%
        </span>
        <span className="text-[10px] text-gray-500">win rate</span>
        <span className="text-[9px] text-gray-400 mt-0.5">
          {total} closed
        </span>
      </div>
    </div>
  );
}

function OutcomeRow({
  label,
  count,
  value,
  dot,
}: {
  label: string;
  count: number;
  value: number;
  dot: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
        <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
        {label}
      </span>
      <span className="text-[11px] text-gray-500 tabular-nums">
        {count} · {money(value, true)}
      </span>
    </div>
  );
}

function AttentionRow({
  item,
  onClick,
}: {
  item: CrmAttentionItem;
  onClick: () => void;
}) {
  const dueLabel = item.expected_close_date
    ? format(parseISO(item.expected_close_date), 'MMM d, yyyy')
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-2.5 rounded-md border border-gray-100 hover:border-gray-200 hover:bg-gray-50/70 transition-colors text-left"
    >
      <div
        className={cn(
          'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
          item.overdue_days > 0
            ? 'bg-red-50 text-red-600'
            : 'bg-amber-50 text-amber-600',
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-gray-900 truncate">
            {item.title}
          </span>
          {item.reasons.map((reason) => (
            <span
              key={reason}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                reason === 'overdue'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-700',
              )}
            >
              {reason}
            </span>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5 truncate">
          {item.organisation} · {item.owner} · {STAGE_META[item.stage]?.label ?? item.stage}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {item.overdue_days > 0
            ? `${item.overdue_days} days overdue`
            : dueLabel
              ? `Due ${dueLabel}`
              : 'No close date'}
          {' · '}
          {item.days_since_activity === 0
            ? 'Active today'
            : `${item.days_since_activity} days since activity`}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-[11px] font-semibold text-gray-900 tabular-nums">
          {money(item.amount_base, true)}
        </div>
        <div className="text-[9px] text-gray-400">{percent(item.probability)}</div>
      </div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6">
      <TrendingUp className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
      <p className="text-[11px] text-gray-500">{message}</p>
    </div>
  );
}

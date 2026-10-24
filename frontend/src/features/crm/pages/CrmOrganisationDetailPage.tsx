import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Target,
  Trophy,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { organisationService } from '@/services/organisation.service';
import {
  crmService,
  type OpportunityStage,
  type OpportunitySummary,
} from '@/services/crm.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const STAGE_META: Record<
  OpportunityStage,
  { label: string; color: string; bg: string; border: string }
> = {
  discovery: { label: 'Discovery', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  qualified: { label: 'Qualified', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  proposal: { label: 'Proposal', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  negotiation: { label: 'Negotiation', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  committed: { label: 'Committed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  won: { label: 'Won', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  lost: { label: 'Lost', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

const TYPE_LABELS: Record<string, string> = {
  grant: 'Grant',
  partnership: 'Partnership',
  contract: 'Contract',
  programme: 'Programme',
};

function formatGhs(value: number) {
  return `GHS ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatOpportunityAmount(opportunity: OpportunitySummary) {
  const value = opportunity.amount_base ?? opportunity.amount;
  if (value == null) return '—';
  return `${opportunity.currency || 'GHS'} ${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function CrmOrganisationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: organisation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['crm', 'organisations', id],
    queryFn: () => organisationService.getById(id!),
    enabled: !!id,
    retry: (failureCount, err: any) =>
      err?.response?.status !== 404 && failureCount < 2,
  });

  const { data: opportunityData, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['crm', 'organisations', id, 'opportunities'],
    queryFn: () =>
      crmService.listOpportunities({ organisation_id: id!, limit: 100 }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-4">
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !organisation) {
    const notFound = (error as any)?.response?.status === 404;
    return (
      <div className="max-w-6xl space-y-4">
        <button
          onClick={() => navigate('/crm/organisations')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organisations
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                {notFound
                  ? 'Organisation not found'
                  : 'Could not load this organisation'}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {notFound
                  ? 'It may have been removed from the directory.'
                  : (error as Error)?.message ?? 'Please try again.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const opportunities = opportunityData?.items ?? [];
  const open = opportunities.filter(
    (opportunity) =>
      opportunity.stage !== 'won' && opportunity.stage !== 'lost',
  );
  const won = opportunities.filter(
    (opportunity) => opportunity.stage === 'won',
  );
  const openValue = open.reduce(
    (sum, opportunity) =>
      sum + (opportunity.amount_base ?? opportunity.amount ?? 0),
    0,
  );
  const wonValue = won.reduce(
    (sum, opportunity) =>
      sum + (opportunity.amount_base ?? opportunity.amount ?? 0),
    0,
  );
  const statusStyle =
    organisation.status === 'active'
      ? 'bg-emerald-50 text-emerald-700'
      : organisation.status === 'archived'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-600';

  return (
    <div className="max-w-6xl space-y-5">
      <button
        onClick={() => navigate('/crm/organisations')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organisations
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-7 h-7 text-primary" strokeWidth={1.5} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                {organisation.name}
              </h1>
              {organisation.code && (
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wider">
                  {organisation.code}
                </span>
              )}
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                  statusStyle,
                )}
              >
                {organisation.status}
              </span>
            </div>

            {organisation.description ? (
              <p className="text-sm text-gray-600 mt-2">
                {organisation.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mt-2">
                No description added yet.
              </p>
            )}

            <div className="flex items-center gap-4 text-[11px] text-gray-500 mt-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Added {format(new Date(organisation.created_at), 'd MMM yyyy')}
              </span>
              {organisation.updated_at && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Updated{' '}
                  {format(new Date(organisation.updated_at), 'd MMM yyyy')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => navigate('/crm/pipeline')}
            className="flex items-center gap-2 px-3.5 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Open pipeline
          </button>
        </div>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SnapshotCard
          icon={Briefcase}
          label="Opportunities"
          value={String(opportunities.length)}
          hint={`${open.length} open`}
        />
        <SnapshotCard
          icon={CircleDollarSign}
          label="Open pipeline"
          value={formatGhs(openValue)}
          hint="Expected value"
        />
        <SnapshotCard
          icon={Trophy}
          label="Won"
          value={String(won.length)}
          hint="Closed successfully"
        />
        <SnapshotCard
          icon={Target}
          label="Won value"
          value={formatGhs(wonValue)}
          hint="Signed value"
        />
      </div>

      {/* Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Opportunities
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Work linked to {organisation.name}
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-500 tabular-nums">
              {opportunities.length}
            </span>
          </div>

          {opportunitiesLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-md animate-pulse"
                />
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Target
                className="w-10 h-10 text-gray-300 mx-auto mb-3"
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium text-gray-700">
                No opportunities yet
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Opportunities linked to this organisation will appear here.
              </p>
              <button
                onClick={() => navigate('/crm/pipeline')}
                className="mt-4 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                Open pipeline
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {opportunities.map((opportunity) => (
                <OpportunityRow
                  key={opportunity.id}
                  opportunity={opportunity}
                  onOpen={() =>
                    navigate(`/crm/opportunities/${opportunity.id}`)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            </div>
            <dl className="p-5 space-y-3">
              <DetailRow label="Status" value={organisation.status} />
              <DetailRow label="Code" value={organisation.code || '—'} />
              <DetailRow
                label="Created"
                value={format(
                  new Date(organisation.created_at),
                  'd MMMM yyyy',
                )}
              />
              <DetailRow
                label="Last updated"
                value={
                  organisation.updated_at
                    ? format(
                        new Date(organisation.updated_at),
                        'd MMMM yyyy',
                      )
                    : '—'
                }
              />
            </dl>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Directory
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              Browse the people and partner organisations you work with.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => navigate('/crm/contacts')}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                CRM contacts
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => navigate('/crm/organisations')}
                className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                All organisations
                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        <Icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
        {label}
      </div>
      <div className="text-lg font-bold text-gray-900 mt-2 tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>
    </div>
  );
}

function OpportunityRow({
  opportunity,
  onOpen,
}: {
  opportunity: OpportunitySummary;
  onOpen: () => void;
}) {
  const stage = STAGE_META[opportunity.stage];

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Target className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-gray-900 truncate">
            {opportunity.title}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border',
              stage.color,
              stage.bg,
              stage.border,
            )}
          >
            {stage.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
          <span>{TYPE_LABELS[opportunity.type] ?? opportunity.type}</span>
          <span className="flex items-center gap-1">
            <Avatar
              firstName={opportunity.owner.first_name}
              lastName={opportunity.owner.last_name}
              imageUrl={opportunity.owner.profile_image_url}
              size="xs"
            />
            {opportunity.owner.first_name} {opportunity.owner.last_name}
          </span>
          {opportunity.expected_close_date && (
            <span>
              Close{' '}
              {format(
                new Date(opportunity.expected_close_date),
                'd MMM yyyy',
              )}
            </span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[13px] font-semibold text-gray-900 tabular-nums">
          {formatOpportunityAmount(opportunity)}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-500 transition-colors" />
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className="text-[12px] font-medium text-gray-900 capitalize text-right">
        {value}
      </dd>
    </div>
  );
}

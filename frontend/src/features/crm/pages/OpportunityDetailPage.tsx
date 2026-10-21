import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  Plus,
  X,
  MessageSquare,
  Phone,
  Mail,
  Users as UsersIcon,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Shield,
  Layers,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import {
  crmService,
  type OpportunityDetail,
  type OpportunityStage,
} from '@/services/crm.service';
import { peopleService } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

// ============================================================
// STAGE METADATA
// ============================================================

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

const STAGES_ORDER: OpportunityStage[] = [
  'discovery',
  'qualified',
  'proposal',
  'negotiation',
  'committed',
  'won',
];

// ============================================================
// PAGE
// ============================================================

export function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('crm.edit');

  const [activityType, setActivityType] = useState<
    'call' | 'email' | 'meeting' | 'site_visit' | 'note'
  >('note');
  const [activitySummary, setActivitySummary] = useState('');
  const [activityNextStep, setActivityNextStep] = useState('');
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [transitionTo, setTransitionTo] = useState<OpportunityStage | null>(null);

  const { data: opp, isLoading, error } = useQuery({
    queryKey: ['crm', 'opportunity', id],
    queryFn: () => crmService.getOpportunity(id!),
    enabled: !!id,
  });

  const addActivityMutation = useMutation({
    mutationFn: () =>
      crmService.addActivity(id!, {
        type: activityType,
        summary: activitySummary,
        next_step: activityNextStep || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'opportunity', id] });
      setActivitySummary('');
      setActivityNextStep('');
      toast.success('Activity logged');
    },
    onError: () => toast.error('Failed to log activity'),
  });

  const transitionMutation = useMutation({
    mutationFn: (payload: {
      to_stage: OpportunityStage;
      note?: string;
      lost_reason?: string;
      lost_notes?: string;
      qualification_criteria?: Record<string, boolean>;
    }) =>
      crmService.transitionStage(
        id!,
        payload as Parameters<typeof crmService.transitionStage>[1],
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['crm', 'pipeline'] });
      setShowTransitionModal(false);
      setTransitionTo(null);
      toast.success('Stage updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to change stage');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="max-w-6xl">
        <button
          onClick={() => navigate('/crm/pipeline')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pipeline
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Could not load this opportunity
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {(error as Error)?.message ?? 'It may have been deleted.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stageMeta = STAGE_META[opp.stage];
  const isClosed = opp.stage === 'won' || opp.stage === 'lost';
  const currentStageIdx = STAGES_ORDER.indexOf(opp.stage);

  const nextStage =
    !isClosed && currentStageIdx < STAGES_ORDER.length - 1
      ? STAGES_ORDER[currentStageIdx + 1]
      : null;

  const handleLogActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activitySummary.trim()) return;
    addActivityMutation.mutate();
  };

  const handleTransition = (to: OpportunityStage) => {
    if (to === 'lost') {
      // Would need a reason modal — for now, quick note prompt
      const reason = prompt('Why was this opportunity lost?');
      if (!reason) return;
      transitionMutation.mutate({ to_stage: 'lost', lost_reason: reason });
      return;
    }
    if (to === 'qualified') {
      // Open the qualification modal
      setTransitionTo('qualified');
      setShowTransitionModal(true);
      return;
    }
    transitionMutation.mutate({ to_stage: to });
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/crm/pipeline')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-700">
                {opp.type}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
                  stageMeta.bg,
                  stageMeta.color,
                  stageMeta.border,
                )}
              >
                {stageMeta.label}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
                {opp.probability}% probability
              </span>
              {opp.strategic_priority === 'high' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-red-700">
                  High priority
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{opp.title}</h1>

            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gray-400" />
                {opp.organisation.name}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-gray-400" />
                {opp.owner.first_name} {opp.owner.last_name}
              </span>
              {opp.expected_close_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Target {format(new Date(opp.expected_close_date), 'MMM d, yyyy')}
                </span>
              )}
            </div>

            {opp.description && (
              <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">
                {opp.description}
              </p>
            )}
          </div>

          {opp.amount != null && (
            <div className="text-right">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Value
              </div>
              <div className="text-3xl font-bold text-gray-900 tabular-nums">
                {opp.currency}{' '}
                {opp.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {opp.amount_type.replace(/_/g, ' ')}
              </div>
            </div>
          )}
        </div>

        {/* Stage transitions */}
        {canEdit && !isClosed && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            {nextStage && (
              <button
                onClick={() => handleTransition(nextStage)}
                disabled={transitionMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Move to {STAGE_META[nextStage].label}
              </button>
            )}

            <button
              onClick={() => handleTransition('lost')}
              disabled={transitionMutation.isPending}
              className="px-4 py-2 border border-gray-200 bg-white text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Mark as Lost
            </button>
          </div>
        )}

        {/* Won / lost banner */}
        {isClosed && (
          <div
            className={cn(
              'mt-6 p-4 rounded-md border',
              opp.stage === 'won'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200',
            )}
          >
            <div className="flex items-start gap-2">
              {opp.stage === 'won' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {opp.stage === 'won' ? 'Won' : 'Lost'}
                  {opp.stage === 'won' && opp.won_at && (
                    <span className="font-normal text-gray-600 ml-2">
                      on {format(new Date(opp.won_at), 'MMM d, yyyy')}
                    </span>
                  )}
                  {opp.stage === 'lost' && opp.lost_at && (
                    <span className="font-normal text-gray-600 ml-2">
                      on {format(new Date(opp.lost_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
                {opp.stage === 'lost' && opp.lost_reason && (
                  <div className="text-xs text-gray-700 mt-1">
                    Reason: {opp.lost_reason.replace(/_/g, ' ')}
                    {opp.lost_notes && ` — ${opp.lost_notes}`}
                  </div>
                )}
                {opp.stage === 'won' && opp.attributed_to && (
                  <div className="text-xs text-gray-700 mt-1">
                    Attributed to: {opp.attributed_to.first_name}{' '}
                    {opp.attributed_to.last_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity timeline */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Activity Timeline
                </h3>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-semibold">
                  {opp.activities.length}
                </span>
              </div>
            </div>

            {/* Log form */}
            {canEdit && (
              <form
                onSubmit={handleLogActivity}
                className="p-4 border-b border-gray-100 bg-gray-50/50"
              >
                <div className="flex gap-2 mb-2">
                  {(
                    [
                      { value: 'note', icon: MessageSquare, label: 'Note' },
                      { value: 'call', icon: Phone, label: 'Call' },
                      { value: 'email', icon: Mail, label: 'Email' },
                      { value: 'meeting', icon: UsersIcon, label: 'Meeting' },
                      { value: 'site_visit', icon: Building2, label: 'Visit' },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setActivityType(t.value)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors',
                          activityType === t.value
                            ? 'bg-primary text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={activitySummary}
                  onChange={(e) => setActivitySummary(e.target.value)}
                  placeholder="What happened?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-2"
                />
                <input
                  type="text"
                  value={activityNextStep}
                  onChange={(e) => setActivityNextStep(e.target.value)}
                  placeholder="Next step (optional)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 mb-2"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!activitySummary.trim() || addActivityMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    {addActivityMutation.isPending ? 'Logging…' : 'Log Activity'}
                  </button>
                </div>
              </form>
            )}

            {/* Timeline */}
            <div className="divide-y divide-gray-100">
              {opp.activities.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Log a call, email, or meeting to get started
                  </p>
                </div>
              ) : (
                opp.activities.map((activity) => {
                  const Icon =
                    activity.type === 'call'
                      ? Phone
                      : activity.type === 'email'
                        ? Mail
                        : activity.type === 'meeting'
                          ? UsersIcon
                          : activity.type === 'site_visit'
                            ? Building2
                            : MessageSquare;

                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-4">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
                            {activity.type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(activity.occurred_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                          {activity.summary}
                        </div>
                        {activity.next_step && (
                          <div className="text-[11px] text-gray-600 mt-1 p-2 bg-gray-50 rounded">
                            <strong>Next:</strong> {activity.next_step}
                          </div>
                        )}
                        {activity.author && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            by {activity.author.first_name} {activity.author.last_name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Stage history */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">
                Stage History
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {opp.stage_history.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  No stage changes yet
                </div>
              ) : (
                opp.stage_history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 p-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">
                        {h.from_stage ? (
                          <>
                            Moved from <strong>{h.from_stage}</strong> to{' '}
                            <strong>{h.to_stage}</strong>
                          </>
                        ) : (
                          <>
                            Created in <strong>{h.to_stage}</strong>
                          </>
                        )}
                      </div>
                      {h.note && (
                        <div className="text-xs text-gray-600 mt-1">{h.note}</div>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {format(new Date(h.changed_at), 'MMM d, yyyy h:mm a')}
                        {h.changed_by && (
                          <>
                            {' · '}
                            {h.changed_by.first_name} {h.changed_by.last_name}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column — details sidebar */}
        <div className="space-y-6">
          {/* Organisation & contact */}
          <DetailCard icon={Building2} title="Organisation">
            <div className="text-sm font-medium text-gray-900">
              {opp.organisation.name}
            </div>
            {opp.organisation.type && (
              <div className="text-xs text-gray-500 capitalize">
                {opp.organisation.type}
              </div>
            )}
            {opp.organisation.country && (
              <div className="text-xs text-gray-500">{opp.organisation.country}</div>
            )}

            {opp.primary_contact && (
              <>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Primary contact
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar
                      firstName={opp.primary_contact.first_name}
                      lastName={opp.primary_contact.last_name}
                      size="sm"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {opp.primary_contact.first_name}{' '}
                        {opp.primary_contact.last_name}
                      </div>
                      {opp.primary_contact.email && (
                        <div className="text-xs text-gray-500">
                          {opp.primary_contact.email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </DetailCard>

          {/* Value details */}
          <DetailCard icon={DollarSign} title="Value">
            {opp.amount != null ? (
              <>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">
                  {opp.currency}{' '}
                  {opp.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {opp.amount_type.replace(/_/g, ' ')}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">Not set</div>
            )}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
              {opp.expected_start_date && (
                <Row
                  label="Expected start"
                  value={format(new Date(opp.expected_start_date), 'MMM d, yyyy')}
                />
              )}
              {opp.expected_close_date && (
                <Row
                  label="Expected close"
                  value={format(new Date(opp.expected_close_date), 'MMM d, yyyy')}
                />
              )}
              {opp.expected_duration_months && (
                <Row
                  label="Duration"
                  value={`${opp.expected_duration_months} months`}
                />
              )}
            </div>
          </DetailCard>

          {/* Source */}
          <DetailCard icon={Layers} title="Source">
            <Row label="How we found it" value={opp.source.replace(/_/g, ' ')} />
            {opp.referred_by && (
              <Row
                label="Referred by"
                value={`${opp.referred_by.first_name} ${opp.referred_by.last_name}`}
              />
            )}
            {opp.campaign && <Row label="Campaign" value={opp.campaign} />}
          </DetailCard>

          {/* Strategic */}
          <DetailCard icon={Target} title="Strategic Fit">
            <Row
              label="Priority"
              value={opp.strategic_priority}
              className="capitalize"
            />
            <Row
              label="Eligibility"
              value={opp.eligibility_check}
              className="capitalize"
            />
            {opp.alignment_notes && (
              <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 whitespace-pre-wrap">
                {opp.alignment_notes}
              </div>
            )}
          </DetailCard>

          {/* Risk */}
          {(opp.competitors.length > 0 ||
            opp.competitive_advantage ||
            opp.known_risks) && (
            <DetailCard icon={Shield} title="Competition & Risk">
              {opp.competitors.length > 0 && (
                <div className="mb-3">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Competitors
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {opp.competitors.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-gray-100 text-[11px] text-gray-700"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {opp.competitive_advantage && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Our advantage
                  </div>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap">
                    {opp.competitive_advantage}
                  </div>
                </div>
              )}
              {opp.known_risks && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Risks
                  </div>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap">
                    {opp.known_risks}
                  </div>
                </div>
              )}
            </DetailCard>
          )}

          {/* Contributors */}
          <ContributorsCard
            opportunityId={opp.id}
            contributors={opp.contributors}
            canEdit={canEdit}
          />

          {/* Requirements */}
          {(opp.required_documents.length > 0 || opp.compliance_notes) && (
            <DetailCard icon={FileText} title="Requirements">
              {opp.required_documents.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Documents required
                  </div>
                  <ul className="space-y-0.5">
                    {opp.required_documents.map((d, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        · {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {opp.compliance_notes && (
                <div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Compliance notes
                  </div>
                  <div className="text-xs text-gray-700 whitespace-pre-wrap">
                    {opp.compliance_notes}
                  </div>
                </div>
              )}
            </DetailCard>
          )}
        </div>
      </div>

      {/* Transition modal for qualification */}
      {showTransitionModal && transitionTo === 'qualified' && (
        <QualifyModal
          opportunity={opp}
          onClose={() => {
            setShowTransitionModal(false);
            setTransitionTo(null);
          }}
          onConfirm={(criteria) => {
            transitionMutation.mutate({
              to_stage: 'qualified',
              qualification_criteria: criteria,
            });
          }}
          isPending={transitionMutation.isPending}
        />
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function DetailCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
        <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={cn('text-gray-900', className)}>{value}</span>
    </div>
  );
}

function ContributorsCard({
  opportunityId,
  contributors,
  canEdit,
}: {
  opportunityId: string;
  contributors: OpportunityDetail['contributors'];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [personId, setPersonId] = useState('');
  const [role, setRole] = useState<'contributor' | 'advisor' | 'sponsor'>(
    'contributor',
  );

  const { data: staff } = useQuery({
    queryKey: ['people', 'staff-for-contributors'],
    queryFn: () => peopleService.getAll({ type: 'staff', limit: 200 }),
    enabled: showForm,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      crmService.addContributor(opportunityId, { person_id: personId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunity', opportunityId],
      });
      setShowForm(false);
      setPersonId('');
      toast.success('Contributor added');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.detail ?? 'Failed to add'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => crmService.removeContributor(opportunityId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['crm', 'opportunity', opportunityId],
      });
      toast.success('Contributor removed');
    },
    onError: () => toast.error('Failed to remove'),
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-wider">
            Contributors
          </h3>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-[10px] font-medium text-primary hover:underline"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-3 p-3 bg-gray-50 rounded-md space-y-2">
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none"
          >
            <option value="">Select person…</option>
            {(staff ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as 'contributor' | 'advisor' | 'sponsor')
            }
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none"
          >
            <option value="contributor">Contributor</option>
            <option value="advisor">Advisor</option>
            <option value="sponsor">Sponsor</option>
          </select>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!personId || addMutation.isPending}
            className="w-full px-2 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {addMutation.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}

      {contributors.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-3">
          No contributors yet
        </div>
      ) : (
        <div className="space-y-2">
          {contributors.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 group"
            >
              <Avatar
                firstName={c.person.first_name}
                lastName={c.person.last_name}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {c.person.first_name} {c.person.last_name}
                </div>
                <div className="text-[10px] text-gray-500 capitalize">
                  {c.role}
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${c.person.first_name}?`)) {
                      removeMutation.mutate(c.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// QUALIFY MODAL
// ============================================================

const QUALIFICATION_CRITERIA = [
  { key: 'has_budget', label: 'They have a budget allocated' },
  { key: 'has_contact', label: 'We have a contact inside the org' },
  { key: 'technically_qualified', label: 'We technically qualify for this' },
  { key: 'timing_ok', label: 'The timing is right' },
  { key: 'strategically_aligned', label: 'It aligns with our strategy' },
] as const;

function QualifyModal({
  opportunity,
  onClose,
  onConfirm,
  isPending,
}: {
  opportunity: OpportunityDetail;
  onClose: () => void;
  onConfirm: (criteria: Record<string, boolean>) => void;
  isPending: boolean;
}) {
  const [criteria, setCriteria] = useState<Record<string, boolean>>(
    opportunity.qualification_criteria || {},
  );

  const passed = QUALIFICATION_CRITERIA.filter((c) => criteria[c.key] === true).length;
  const canSubmit = passed >= 3 && opportunity.activities.length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Qualify opportunity
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Check at least 3 criteria to move to Qualified
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {QUALIFICATION_CRITERIA.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={criteria[c.key] === true}
                onChange={(e) =>
                  setCriteria({ ...criteria, [c.key]: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">{c.label}</span>
            </label>
          ))}

          {opportunity.activities.length === 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                Log at least one activity before qualifying.
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
            <strong>{passed}</strong> of 5 criteria met
            {passed < 3 && ' — need at least 3'}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(criteria)}
            disabled={!canSubmit || isPending}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {isPending ? 'Qualifying…' : 'Mark as Qualified'}
          </button>
        </div>
      </div>
    </div>
  );
}
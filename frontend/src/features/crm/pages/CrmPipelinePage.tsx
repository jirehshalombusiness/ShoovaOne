import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  X,
  Building2,
  User,
  Calendar,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  crmService,
  type OpportunitySummary,
  type OpportunityStage,
  type OpportunityType,
  type StrategicPriority,
} from '@/services/crm.service';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

const STAGES: {
  key: OpportunityStage;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  { key: 'discovery', label: 'Discovery', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
  { key: 'qualified', label: 'Qualified', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'proposal', label: 'Proposal', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { key: 'negotiation', label: 'Negotiation', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'committed', label: 'Committed', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'won', label: 'Won', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'lost', label: 'Lost', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
];

export function CrmPipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('crm.edit');
  const canCreate = hasPermission('crm.create');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<OpportunityType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<StrategicPriority | ''>('');
  const [showClosed, setShowClosed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<OpportunityStage | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'pipeline', { showClosed }],
    queryFn: () =>
      crmService.listOpportunities({
        limit: 500,
        // Include closed only when the toggle is on
        ...(showClosed ? {} : { open_only: true }),
      }),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, to_stage }: { id: string; to_stage: OpportunityStage }) =>
      crmService.transitionStage(id, { to_stage }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['crm', 'pipeline'] });
      toast.success(`Moved to ${vars.to_stage}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to move opportunity');
    },
  });

  const filtered = useMemo(() => {
    let items = data?.items ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.organisation.name.toLowerCase().includes(q),
      );
    }

    if (typeFilter) {
      items = items.filter((o) => o.type === typeFilter);
    }

    if (priorityFilter) {
      items = items.filter((o) => o.strategic_priority === priorityFilter);
    }

    return items;
  }, [data, search, typeFilter, priorityFilter]);

  const byStage = useMemo(() => {
    const map: Record<OpportunityStage, OpportunitySummary[]> = {
      discovery: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      committed: [],
      won: [],
      lost: [],
    };
    for (const opp of filtered) {
      map[opp.stage].push(opp);
    }
    return map;
  }, [filtered]);

  const visibleStages = showClosed
    ? STAGES
    : STAGES.filter((s) => s.key !== 'won' && s.key !== 'lost');

  // ---- Drag and drop ----

  const handleDragStart = (id: string) => {
    if (!canEdit) return;
    setDraggedId(id);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDropTargetStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stage: OpportunityStage) => {
    if (!draggedId || !canEdit) return;
    e.preventDefault();
    setDropTargetStage(stage);
  };

  const handleDragLeave = (stage: OpportunityStage) => {
    if (dropTargetStage === stage) {
      setDropTargetStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, toStage: OpportunityStage) => {
    e.preventDefault();
    if (!draggedId || !canEdit) return;

    const opp = filtered.find((o) => o.id === draggedId);
    if (!opp) return;

    if (opp.stage === toStage) {
      setDraggedId(null);
      setDropTargetStage(null);
      return;
    }

    // Guard: cannot move to "lost" without a reason — the modal would be needed
    if (toStage === 'lost') {
      toast.error('Use the opportunity detail page to mark as lost (a reason is required)');
      setDraggedId(null);
      setDropTargetStage(null);
      return;
    }

    transitionMutation.mutate({ id: draggedId, to_stage: toStage });
    setDraggedId(null);
    setDropTargetStage(null);
  };

  // ---- Helpers ----

  const totals = useMemo(() => {
    const open = filtered.filter(
      (o) => o.stage !== 'won' && o.stage !== 'lost',
    );
    const total = open.reduce((sum, o) => sum + (o.amount_base || 0), 0);
    const weighted = open.reduce(
      (sum, o) => sum + ((o.amount_base || 0) * o.probability) / 100,
      0,
    );
    return { openCount: open.length, total, weighted };
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-96 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar — stats + actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <Stat label="Open opportunities" value={totals.openCount} />
          <Stat
            label="Total value"
            value={`GHS ${totals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <Stat
            label="Weighted forecast"
            value={`GHS ${totals.weighted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            tone="primary"
          />
        </div>

        {canCreate && (
          <button
            onClick={() => navigate('/crm/opportunities/new')}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Opportunity
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or organisation…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as OpportunityType | '')}
            className="px-3 py-2 border border-gray-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All types</option>
            <option value="grant">Grant</option>
            <option value="partnership">Partnership</option>
            <option value="contract">Contract</option>
            <option value="programme">Programme</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as StrategicPriority | '')}
            className="px-3 py-2 border border-gray-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <button
          onClick={() => setShowClosed((v) => !v)}
          className={cn(
            'px-3 py-2 rounded-md text-xs font-medium border transition-colors',
            showClosed
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
          )}
        >
          {showClosed ? 'Hide closed' : 'Show won / lost'}
        </button>
      </div>

      {/* Kanban columns */}
      <div className="overflow-x-auto pb-4">
        <div
          className="flex gap-4 min-h-[600px]"
          style={{ minWidth: `${visibleStages.length * 300}px` }}
        >
          {visibleStages.map((stage) => {
            const items = byStage[stage.key];
            const stageValue = items.reduce((s, o) => s + (o.amount_base || 0), 0);
            const isDropTarget = dropTargetStage === stage.key;

            return (
              <div
                key={stage.key}
                onDragOver={(e) => handleDragOver(e, stage.key)}
                onDragLeave={() => handleDragLeave(stage.key)}
                onDrop={(e) => handleDrop(e, stage.key)}
                className={cn(
                  'flex-1 min-w-[280px] max-w-[340px] flex flex-col rounded-lg border transition-colors',
                  stage.bg,
                  stage.border,
                  isDropTarget && 'ring-2 ring-primary ring-offset-2',
                )}
              >
                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-white/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[13px] font-semibold', stage.color)}>
                        {stage.label}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70 text-gray-600">
                        {items.length}
                      </span>
                    </div>
                  </div>
                  {stageValue > 0 && (
                    <div className="text-[10px] text-gray-600 mt-0.5 tabular-nums">
                      GHS {stageValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[560px]">
                  {items.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-gray-400">
                      No opportunities
                    </div>
                  ) : (
                    items.map((opp) => (
                      <KanbanCard
                        key={opp.id}
                        opportunity={opp}
                        isDragging={draggedId === opp.id}
                        canDrag={canEdit}
                        onClick={() => navigate(`/crm/opportunities/${opp.id}`)}
                        onDragStart={() => handleDragStart(opp.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'primary';
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={cn(
          'text-xl font-bold tabular-nums',
          tone === 'primary' ? 'text-primary' : 'text-gray-900',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function KanbanCard({
  opportunity,
  isDragging,
  canDrag,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  opportunity: OpportunitySummary;
  isDragging: boolean;
  canDrag: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const typeStyles: Record<OpportunityType, string> = {
    grant: 'bg-blue-100 text-blue-700',
    partnership: 'bg-purple-100 text-purple-700',
    contract: 'bg-amber-100 text-amber-700',
    programme: 'bg-emerald-100 text-emerald-700',
  };

  const priorityStyles: Record<StrategicPriority, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-gray-300',
  };

  const isOverdue =
    opportunity.expected_close_date &&
    new Date(opportunity.expected_close_date) < new Date() &&
    opportunity.stage !== 'won' &&
    opportunity.stage !== 'lost';

  return (
    <div
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 border-l-4 rounded-md p-2.5 cursor-pointer transition-all',
        'hover:shadow-md hover:border-gray-300',
        priorityStyles[opportunity.strategic_priority],
        canDrag && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
            typeStyles[opportunity.type],
          )}
        >
          {opportunity.type}
        </span>
        <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0">
          {opportunity.probability}%
        </span>
      </div>

      <div className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2 mb-1">
        {opportunity.title}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-2">
        <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
        <span className="truncate">{opportunity.organisation.name}</span>
      </div>

      {opportunity.amount != null && (
        <div className="mb-1">
          <div className="text-[13px] font-bold text-gray-900 tabular-nums">
            {opportunity.currency}{' '}
            {opportunity.amount.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </div>
          {opportunity.currency !== 'GHS' &&
            opportunity.amount_base != null && (
              <div className="text-[9px] text-gray-500 tabular-nums">
                ≈ GHS{' '}
                {opportunity.amount_base.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
            )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10px] mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1 text-gray-500">
          <User className="w-2.5 h-2.5" />
          <span className="truncate max-w-[100px]">
            {opportunity.owner.first_name} {opportunity.owner.last_name}
          </span>
        </div>
        {opportunity.expected_close_date && (
          <div
            className={cn(
              'flex items-center gap-1',
              isOverdue ? 'text-red-600 font-medium' : 'text-gray-400',
            )}
          >
            <Calendar className="w-2.5 h-2.5" />
            {format(new Date(opportunity.expected_close_date), 'MMM d')}
          </div>
        )}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarRange,
  Layers,
  MapPin,
  Plus,
  Search,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DELIVERY_MODE_LABELS,
  programmesService,
  type CohortStatus,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';
import { CohortStatusBadge } from '../components/ProgrammeBadges';
import { ProgrammePicker } from '../components/ProgrammePicker';
import { CohortModal, type CohortFormValues } from '../components/CohortModal';
import { formatDateRange } from '../programmeUtils';

export function ProgrammeCohortsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();
  const canManage = access.has('programmes.edit');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CohortStatus | ''>('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [pickProgramme, setPickProgramme] = useState(false);
  const [createFor, setCreateFor] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: [
      'programmes',
      'cohorts',
      'directory',
      search,
      statusFilter,
      programmeFilter,
    ],
    queryFn: () =>
      programmesService.listCohorts({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        programme_id: programmeFilter || undefined,
        limit: 500,
      }),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (values: CohortFormValues) =>
      programmesService.createCohort(createFor, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
      setCreateFor('');
      toast.success('Cohort created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create cohort');
    },
  });

  const cohorts = data ?? [];
  const filtering = !!search || !!statusFilter || !!programmeFilter;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Cohorts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every intake across your programmes
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setPickProgramme(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New cohort
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cohorts or programmes…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as CohortStatus | '')
          }
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="planned">Planned</option>
          <option value="enrolling">Enrolling</option>
          <option value="active">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div className="min-w-[200px] max-w-xs flex-1">
          <ProgrammePicker
            value={programmeFilter}
            onChange={setProgrammeFilter}
            includeClosed
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : cohorts.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {filtering ? 'No cohorts match these filters' : 'No cohorts yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filtering
              ? 'Try widening your search.'
              : 'Create an intake on a programme to start enrolling learners.'}
          </p>
          {canManage && !filtering && (
            <button
              onClick={() => setPickProgramme(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New cohort
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cohorts.map((cohort) => {
            const fill = cohort.capacity
              ? Math.min(
                  100,
                  Math.round((cohort.enrolled_count / cohort.capacity) * 100),
                )
              : null;
            return (
              <button
                key={cohort.id}
                onClick={() => navigate(`/programmes/cohort/${cohort.id}`)}
                className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CohortStatusBadge status={cohort.status} />
                      {cohort.code && (
                        <span className="text-[10px] font-mono text-gray-400">
                          {cohort.code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-semibold text-gray-900 mt-2 truncate group-hover:text-primary transition-colors">
                      {cohort.name}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {cohort.programme_name}
                    </p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>

                <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <CalendarRange className="w-3 h-3" />
                    {formatDateRange(cohort.start_date, cohort.end_date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {cohort.enrolled_count}
                    {cohort.capacity ? ` / ${cohort.capacity}` : ''} learners
                  </span>
                  <span className="flex items-center gap-1">
                    <UsersRound className="w-3 h-3" />
                    {cohort.instructor_count}{' '}
                    {cohort.instructor_count === 1 ? 'instructor' : 'instructors'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {cohort.location || DELIVERY_MODE_LABELS[cohort.delivery_mode]}
                  </span>
                </div>

                {fill !== null && (
                  <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        fill >= 100 ? 'bg-amber-500' : 'bg-primary',
                      )}
                      style={{ width: `${fill}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {pickProgramme && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setPickProgramme(false)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  New cohort
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Which programme is this intake for?
                </p>
              </div>
              <button
                onClick={() => setPickProgramme(false)}
                className="p-1.5 rounded-md hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-5 py-4">
              <ProgrammePicker
                value={createFor}
                onChange={(id) => {
                  setCreateFor(id);
                  if (id) setPickProgramme(false);
                }}
              />
              <p className="text-[11px] text-gray-400 mt-2">
                Completed and archived programmes are hidden.
              </p>
            </div>
          </div>
        </div>
      )}

      {createFor && (
        <CohortModal
          isSaving={createMutation.isPending}
          onClose={() => setCreateFor('')}
          onSave={(values) => createMutation.mutate(values)}
        />
      )}
    </div>
  );
}
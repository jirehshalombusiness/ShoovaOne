import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarRange,
  Edit,
  GraduationCap,
  Layers,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PROGRAMME_LEVEL_LABELS,
  programmesService,
  type ProgrammeLevel,
  type ProgrammeStatus,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ProgrammeStatusBadge } from '../components/ProgrammeBadges';
import { ProgrammeOverviewTab } from '../components/ProgrammeOverviewTab';
import { ProgrammeCurriculumTab } from '../components/ProgrammeCurriculumTab';
import { ProgrammeCohortsTab } from '../components/ProgrammeCohortsTab';
import { formatDateRange } from '../programmeUtils';

type TabKey = 'overview' | 'curriculum' | 'cohorts';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'cohorts', label: 'Cohorts' },
];

const STATUS_ACTIONS: Record<
  ProgrammeStatus,
  { label: string; status: ProgrammeStatus }[]
> = {
  draft: [
    { label: 'Activate', status: 'active' },
    { label: 'Archive', status: 'archived' },
  ],
  active: [
    { label: 'Mark completed', status: 'completed' },
    { label: 'Archive', status: 'archived' },
  ],
  completed: [{ label: 'Archive', status: 'archived' }],
  archived: [],
};

export function ProgrammeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('tab') as TabKey) || 'overview';
  const canManage = access.has('programmes.edit');

  const { data: programme, isLoading, error } = useQuery({
    queryKey: ['programmes', 'detail', id],
    queryFn: () => programmesService.get(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ProgrammeStatus) =>
      programmesService.changeStatus(id!, status),
    onSuccess: (data) => {
      queryClient.setQueryData(['programmes', 'detail', id], data);
      queryClient.invalidateQueries({ queryKey: ['programmes', 'list'] });
      toast.success('Programme status updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update status');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl p-6 space-y-4">
        <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !programme) {
    return (
      <div className="max-w-5xl p-6">
        <button
          onClick={() => navigate('/programmes')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Programmes
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load this programme
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'It may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isDraft = programme.status === 'draft';

  return (
    <div className="max-w-5xl p-6 space-y-5">
      <button
        onClick={() => navigate('/programmes')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Programmes
      </button>

      {isDraft && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">
              This programme is still a draft
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Only programme managers can see it. You can still build the
              curriculum and cohorts, then activate it when ready.
            </p>
          </div>
        </div>
      )}

      {programme.status === 'archived' && (
        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-gray-800">
              This programme is archived
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              It stays visible for records but is closed to new cohorts.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <ProgrammeStatusBadge status={programme.status} />
              {programme.code && (
                <span className="text-[11px] font-mono text-gray-500">
                  {programme.code}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              {programme.name}
            </h1>

            {programme.description && (
              <p className="text-sm text-gray-700 mt-2 max-w-3xl whitespace-pre-wrap">
                {programme.description}
              </p>
            )}

            <div className="flex items-center gap-5 text-xs text-gray-500 mt-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                {programme.level
                  ? PROGRAMME_LEVEL_LABELS[programme.level as ProgrammeLevel]
                  : 'Level not set'}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5" />
                {formatDateRange(programme.start_date, programme.end_date)}
              </span>
              {programme.duration_weeks && (
                <span>{programme.duration_weeks} weeks</span>
              )}
              {programme.department_name && (
                <span>{programme.department_name}</span>
              )}
              {programme.organisation_name && (
                <span>{programme.organisation_name}</span>
              )}
            </div>

            {programme.lead && (
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <Avatar
                  firstName={programme.lead.first_name}
                  lastName={programme.lead.last_name}
                  imageUrl={programme.lead.profile_image_url}
                  size="xs"
                />
                <span>
                  Led by{' '}
                  <strong className="text-gray-700">
                    {programme.lead.first_name} {programme.lead.last_name}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => navigate(`/programmes/${programme.id}/edit`)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>

              {STATUS_ACTIONS[programme.status].map((action) => (
                <button
                  key={action.status}
                  onClick={() => statusMutation.mutate(action.status)}
                  disabled={statusMutation.isPending}
                  className={cn(
                    'px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50',
                    action.status === 'archived'
                      ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'bg-primary text-white hover:bg-primary-dark',
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-100">
          <Stat
            icon={BookOpen}
            label="Courses"
            value={programme.course_count}
          />
          <Stat
            icon={Layers}
            label="Cohorts"
            value={programme.cohort_count}
          />
          <Stat
            icon={Users}
            label="Learners"
            value={programme.learner_count}
          />
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex items-center gap-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() =>
                setSearchParams(
                  item.key === 'overview' ? {} : { tab: item.key },
                )
              }
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === item.key
                  ? 'border-primary text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              {item.label}
              {item.key === 'curriculum' && programme.course_count > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {programme.course_count}
                </span>
              )}
              {item.key === 'cohorts' && programme.cohort_count > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                  {programme.cohort_count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'curriculum' ? (
        <ProgrammeCurriculumTab
          programme={programme}
          canManage={canManage}
        />
      ) : tab === 'cohorts' ? (
        <ProgrammeCohortsTab programme={programme} canManage={canManage} />
      ) : (
        <ProgrammeOverviewTab programme={programme} />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <div className="text-lg font-semibold text-gray-900 tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

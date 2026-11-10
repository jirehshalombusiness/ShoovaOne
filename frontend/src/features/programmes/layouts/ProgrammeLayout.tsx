import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  BarChart3,
  GraduationCap,
  Layers,
  Settings2,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  programmesService,
  type ProgrammeStatus,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ProgrammeStatusBadge } from '../components/ProgrammeBadges';
import {
  ProgrammeWorkspaceContext,
  type ProgrammeWorkspace,
} from '../programmeWorkspace';

type WorkspaceNavItem = {
  label: string;
  segment: string;
  end?: boolean;
  icon: React.ElementType;
  editOnly?: boolean;
  countKey?: 'course_count' | 'cohort_count' | 'learner_count';
};

const NAV_ITEMS: WorkspaceNavItem[] = [
  { label: 'Overview', segment: '', end: true, icon: GraduationCap },
  { label: 'Curriculum', segment: 'curriculum', icon: BookOpen, countKey: 'course_count' },
  { label: 'Learners', segment: 'learners', icon: Users, countKey: 'learner_count' },
  { label: 'Cohorts', segment: 'cohorts', icon: Layers, countKey: 'cohort_count' },
  { label: 'Reports', segment: 'reports', icon: BarChart3 },
  { label: 'Settings', segment: 'edit', icon: Settings2, editOnly: true },
];

export function ProgrammeLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const access = useHRAccess();
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
      <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)]">
        <div className="hidden lg:block w-[240px] flex-shrink-0 border-r border-gray-200 bg-white p-4 space-y-3">
          <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="space-y-2 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6 space-y-4">
          <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !programme) {
    return (
      <div className="max-w-3xl p-6">
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

  const items = NAV_ITEMS.filter((item) => !item.editOnly || canManage);
  const base = `/programmes/${programme.id}`;
  const pathFor = (item: WorkspaceNavItem) =>
    item.segment ? `${base}/${item.segment}` : base;

  const context: ProgrammeWorkspace = {
    programme,
    canManage,
    changeStatus: (status) => statusMutation.mutate(status),
    isChangingStatus: statusMutation.isPending,
  };

  return (
    <ProgrammeWorkspaceContext.Provider value={context}>
      <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] lg:min-h-0 lg:overflow-hidden">
        <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 border-r border-gray-200 bg-white">
          <div className="px-4 py-4 border-b border-gray-100">
            <button
              onClick={() => navigate('/programmes')}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All programmes
            </button>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <ProgrammeStatusBadge status={programme.status} />
              {programme.code && (
                <span className="text-[10px] font-mono text-gray-400">
                  {programme.code}
                </span>
              )}
            </div>
            <h2 className="text-[15px] font-bold text-gray-900 tracking-tight mt-1.5 leading-snug">
              {programme.name}
            </h2>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon;
                const count = item.countKey
                  ? programme[item.countKey]
                  : undefined;
                return (
                  <NavLink
                    key={item.label}
                    to={pathFor(item)}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      )
                    }
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                    <span className="flex-1">{item.label}</span>
                    {count != null && count > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 tabular-nums">
                        {count}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {programme.lead && (
            <div className="border-t border-gray-100 p-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Programme lead
              </div>
              <div className="flex items-center gap-2">
                <Avatar
                  firstName={programme.lead.first_name}
                  lastName={programme.lead.last_name}
                  imageUrl={programme.lead.profile_image_url}
                  size="xs"
                />
                <span className="text-[12px] font-medium text-gray-700 truncate">
                  {programme.lead.first_name} {programme.lead.last_name}
                </span>
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 py-4 lg:py-6 pr-4 lg:pr-6 pb-24 lg:pb-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          {/* Mobile section nav */}
          <div className="lg:hidden sticky top-0 z-10 -mx-4 px-4 mb-4 bg-gray-50/95 backdrop-blur border-b border-gray-200">
            <div className="flex items-center gap-2 py-2">
              <button
                onClick={() => navigate('/programmes')}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 flex-shrink-0"
                title="All programmes"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <nav className="flex overflow-x-auto gap-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.label}
                      to={pathFor(item)}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors',
                          isActive
                            ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-800',
                        )
                      }
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </ProgrammeWorkspaceContext.Provider>
  );
}
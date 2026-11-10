import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Layers, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import { programmesService } from '@/services/programmes.service';

type ProgrammesNavItem = {
  label: string;
  path: string;
  exact?: boolean;
  icon: React.ElementType;
};

const NAV_ITEMS: ProgrammesNavItem[] = [
  { label: 'Programmes', path: '/programmes', exact: true, icon: GraduationCap },
  { label: 'Learners', path: '/programmes/learners', icon: Users },
  { label: 'Cohorts', path: '/programmes/cohorts', icon: Layers },
];

export function ProgrammesLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const access = useHRAccess();
  const canCreate = access.has('programmes.create');

  const { data: programmes } = useQuery({
    queryKey: ['programmes', 'list', 'sidebar'],
    queryFn: () => programmesService.list({ limit: 500 }),
    refetchInterval: 5 * 60_000,
  });

  const { data: learners } = useQuery({
    queryKey: ['programmes', 'learners', 'sidebar'],
    queryFn: () =>
      programmesService.listLearners({ status: 'enrolled', limit: 500 }),
    refetchInterval: 5 * 60_000,
  });

  const isActive = (item: ProgrammesNavItem) => {
    if (item.exact) return location.pathname === item.path;
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const programmeCount = programmes?.length ?? 0;
  const activeLearners = learners?.length ?? 0;
  const activeProgrammes =
    programmes?.filter((p) => p.status === 'active').length ?? 0;

  return (
    <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] lg:min-h-0 lg:overflow-hidden">
      <aside className="hidden lg:flex flex-col w-[220px] flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="px-4 py-5 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">
            Programmes
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Learning &amp; cohorts
          </p>

          {canCreate && (
            <button
              onClick={() => navigate('/programmes/new')}
              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Programme
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Workspace
          </div>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.exact}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            At a glance
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900 tabular-nums">
              {activeLearners}
            </span>
            <span className="text-[10px] text-gray-500">active learners</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                activeProgrammes > 0 ? 'bg-emerald-500' : 'bg-gray-300',
              )}
            />
            <span className="text-[11px] font-medium text-gray-500">
              {programmeCount} programme{programmeCount === 1 ? '' : 's'}
              {activeProgrammes > 0 ? ` · ${activeProgrammes} active` : ''}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-20 border-t border-gray-200 bg-white">
        <nav className="flex overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.exact}
                className={cn(
                  'flex-1 min-w-[72px] flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-gray-500',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={active ? 2.25 : 1.75} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 min-w-0 py-4 lg:py-6 pr-4 lg:pr-6 pb-24 lg:pb-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
        <Outlet />
      </main>
    </div>
  );
}
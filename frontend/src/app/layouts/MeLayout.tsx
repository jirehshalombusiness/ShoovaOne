import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Cake, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ME_TABS, type NavItem } from '@/app/nav.config';
import { meService } from '@/services/me.service';

const SECTION_PATHS: Array<{ label?: string; paths: string[] }> = [
  {
    paths: [
      '/me',
      '/me/approvals',
      '/me/time-off',
      '/me/finance',
    ],
  },
  {
    label: 'Records',
    paths: [
      '/me/compensation',
      '/me/payslips',
      '/me/documents',
      '/me/contract',
      '/me/devices',
    ],
  },
  { label: 'Account', paths: ['/me/profile'] },
];

const ITEMS_BY_PATH = new Map(ME_TABS.map((tab) => [tab.path, tab]));

const SECTIONS = SECTION_PATHS.map((section) => ({
  label: section.label,
  items: section.paths
    .map((path) => ITEMS_BY_PATH.get(path))
    .filter((item): item is NavItem => Boolean(item)),
}));

export function MeLayout() {
  const location = useLocation();

  // Shared with MeHomePage — one cache entry for the whole section.
  const { data } = useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => meService.getHome(),
    staleTime: 60_000,
  });

  const person = data?.person;
  const pending = data?.pending_approvals.length ?? 0;
  const initials =
    (person?.first_name?.[0] ?? '') + (person?.last_name?.[0] ?? '');
  const missingDob = Boolean(person) && !person?.date_of_birth;

  const isActive = (item: NavItem) => {
    if (item.exact) return location.pathname === item.path;
    return (
      location.pathname === item.path ||
      location.pathname.startsWith(`${item.path}/`)
    );
  };

  const allItems = SECTIONS.flatMap((section) => section.items);

  return (
    <div className="flex gap-6 -m-4 lg:-m-6 min-h-[calc(100vh-56px)]">
      {/* Secondary sidebar */}
      <aside className="hidden lg:flex flex-col w-[236px] flex-shrink-0 border-r border-gray-200 bg-white">
        <NavLink
          to="/me/profile"
          className="px-4 pt-6 pb-5 border-b border-gray-100 group"
        >
          <div className="flex items-center gap-3">
            {person?.profile_image_url ? (
              <img
                src={person.profile_image_url}
                alt=""
                className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/10 flex-shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                {initials || '··'}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-gray-900 truncate group-hover:text-primary transition-colors">
                {person ? `${person.first_name} ${person.last_name}` : 'My HR'}
              </div>
              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                {person?.job_title ?? 'Employee self-service'}
              </div>
            </div>
          </div>

          {(person?.department || person?.location) && (
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5">
                {person?.department || person?.location}
              </span>
              <span className="ml-auto flex items-center gap-1 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          )}
        </NavLink>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {SECTIONS.map((section, idx) => (
            <div key={section.label ?? 'workspace'} className={cn(idx > 0 && 'mt-4')}>
              {section.label && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {section.label}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  const badge =
                    item.path === '/me/approvals' && pending > 0 ? pending : null;

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
                      <span className="flex-1">{item.label}</span>
                      {badge !== null && (
                        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold tabular-nums">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3 space-y-2">
          {missingDob && (
            <NavLink
              to="/me/profile"
              className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-100 hover:bg-amber-100/70 transition-colors"
            >
              <Cake className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-amber-900">
                  Add your birthday
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5 leading-snug">
                  So HR can include you in celebrations
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
            </NavLink>
          )}

          <div className="flex items-center gap-1.5 px-2 text-[10px] text-gray-400">
            <ShieldCheck className="w-3 h-3" />
            Self-service HR · People &amp; compliance
          </div>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-20 border-t border-gray-200 bg-white">
        <nav className="flex overflow-x-auto">
          {allItems.map((item) => {
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

      {/* Content */}
      <main className="flex-1 min-w-0 py-4 lg:py-6 pr-4 lg:pr-6 pb-24 lg:pb-6">
        <Outlet />
      </main>
    </div>
  );
}

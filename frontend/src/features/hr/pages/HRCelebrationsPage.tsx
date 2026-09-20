import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Cake,
  TrendingUp,
  Calendar as CalendarIcon,
  PartyPopper,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { hrService, type CelebrationItem } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function HRCelebrationsPage() {
  const navigate = useNavigate();
  const [daysAhead, setDaysAhead] = useState(60);
  const [kindFilter, setKindFilter] = useState<'all' | 'birthday' | 'anniversary'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'celebrations', daysAhead],
    queryFn: () =>
      hrService.getCelebrations({
        days_ahead: daysAhead,
        include_birthdays: true,
        include_anniversaries: true,
      }),
  });

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return items;
    return items.filter((i) => i.kind === kindFilter);
  }, [items, kindFilter]);

  const grouped = useMemo(() => {
    const today: CelebrationItem[] = [];
    const thisWeek: CelebrationItem[] = [];
    const thisMonth: CelebrationItem[] = [];
    const later: CelebrationItem[] = [];

    for (const c of filtered) {
      if (c.days_away === 0) today.push(c);
      else if (c.days_away <= 7) thisWeek.push(c);
      else if (c.days_away <= 30) thisMonth.push(c);
      else later.push(c);
    }

    return { today, thisWeek, thisMonth, later };
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Celebrations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Birthdays and work anniversaries across the organisation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Kind filter */}
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: 'All', count: items.length },
              {
                value: 'birthday',
                label: 'Birthdays',
                count: data?.birthdays_count ?? 0,
              },
              {
                value: 'anniversary',
                label: 'Anniversaries',
                count: data?.anniversaries_count ?? 0,
              },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setKindFilter(f.value as typeof kindFilter)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  kindFilter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums',
                      kindFilter === f.value ? 'opacity-80' : 'text-gray-400',
                    )}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Window */}
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value={30}>Next 30 days</option>
            <option value={60}>Next 60 days</option>
            <option value={90}>Next 90 days</option>
            <option value={365}>Next year</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-20">
          <Cake className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {kindFilter === 'all'
              ? 'No celebrations'
              : `No ${kindFilter === 'birthday' ? 'birthdays' : 'anniversaries'}`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Nothing in the next {daysAhead} days
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.today.length > 0 && (
            <Group title="Today" items={grouped.today} onNavigate={navigate} highlight />
          )}
          {grouped.thisWeek.length > 0 && (
            <Group title="This week" items={grouped.thisWeek} onNavigate={navigate} />
          )}
          {grouped.thisMonth.length > 0 && (
            <Group title="This month" items={grouped.thisMonth} onNavigate={navigate} />
          )}
          {grouped.later.length > 0 && (
            <Group
              title={`Later · up to ${daysAhead} days`}
              items={grouped.later}
              onNavigate={navigate}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// GROUP
// ============================================================

function Group({
  title,
  items,
  onNavigate,
  highlight,
}: {
  title: string;
  items: CelebrationItem[];
  onNavigate: (path: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'border rounded-lg bg-white overflow-hidden',
        highlight ? 'border-primary/30 ring-1 ring-primary/10' : 'border-gray-200',
      )}
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => onNavigate(`/hr/employees/${c.person_id}`)}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <Avatar
              firstName={c.first_name}
              lastName={c.last_name}
              imageUrl={c.profile_image_url}
              size="md"
            />

            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-gray-900 truncate">
                {c.first_name} {c.last_name}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                {c.job_title && <span className="truncate">{c.job_title}</span>}
                {c.job_title && c.department && <span>·</span>}
                {c.department && <span className="truncate">{c.department}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {c.kind === 'birthday' ? (
                <Cake className="w-4 h-4 text-pink-500" />
              ) : (
                <PartyPopper className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-[12px] font-medium text-gray-700">
                {c.kind === 'birthday' ? 'Turns' : 'Celebrates'} {c.years}
              </span>
            </div>

            <div className="text-right flex-shrink-0 min-w-[80px]">
              <div className="text-[12px] font-semibold text-gray-900">
                {c.days_away === 0
                  ? 'Today'
                  : c.days_away === 1
                    ? 'Tomorrow'
                    : `In ${c.days_away} days`}
              </div>
              <div className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                <CalendarIcon className="w-2.5 h-2.5" />
                {format(new Date(c.date), 'MMM d, yyyy')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
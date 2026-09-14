import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { Cake, Calendar as CalendarIcon, PartyPopper } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function HRCelebrationsPage() {
  const [daysAhead, setDaysAhead] = useState(90);
  const { data: celebrations, isLoading } = useQuery({
    queryKey: ['hr', 'celebrations', daysAhead],
    queryFn: () => hrService.getCelebrations(daysAhead),
  });

  const grouped = (celebrations || []).reduce((acc: any, c: any) => {
    const key = c.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Celebrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Birthdays and work anniversaries
          </p>
        </div>
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

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !celebrations || celebrations.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Cake className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No celebrations</p>
          <p className="text-xs text-gray-400 mt-1">
            Nothing in the next {daysAhead} days
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.birthday && grouped.birthday.length > 0 && (
            <CelebrationGroup
              title="Birthdays"
              icon={Cake}
              items={grouped.birthday}
            />
          )}
          {grouped.anniversary && grouped.anniversary.length > 0 && (
            <CelebrationGroup
              title="Work Anniversaries"
              icon={PartyPopper}
              items={grouped.anniversary}
            />
          )}
        </div>
      )}
    </div>
  );
}

function CelebrationGroup({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ElementType;
  items: any[];
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <Avatar
              firstName={c.first_name}
              lastName={c.last_name}
              imageUrl={c.image_url}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-gray-900">
                {c.first_name} {c.last_name}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">{c.label}</div>
            </div>
            <div className="text-right">
              <div
                className={cn(
                  'text-[12px] font-semibold',
                  c.days_away === 0 ? 'text-primary' : 'text-gray-700'
                )}
              >
                {c.days_away === 0
                  ? 'Today'
                  : c.days_away === 1
                  ? 'Tomorrow'
                  : `In ${c.days_away} days`}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1 justify-end">
                <CalendarIcon className="w-2.5 h-2.5" />
                {format(new Date(c.date), 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
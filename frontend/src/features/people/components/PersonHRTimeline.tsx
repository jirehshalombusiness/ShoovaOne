import { useQuery } from '@tanstack/react-query';
import { Clock, History } from 'lucide-react';
import { format } from 'date-fns';
import { hrService } from '@/services/hr.service';

interface Props {
  personId: string;
}

export function PersonHRTimeline({ personId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'employee', personId, 'timeline'],
    queryFn: () => hrService.getEmployeeTimeline(personId, { limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  const entries = data ?? [];

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <History className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">No activity recorded</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3 px-5 py-4">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-gray-900 uppercase tracking-wider">
                {entry.action.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-gray-400">
                {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            {entry.description && (
              <p className="text-[13px] text-gray-700 mt-1">{entry.description}</p>
            )}
            {entry.actor_name && (
              <p className="text-[11px] text-gray-500 mt-1">by {entry.actor_name}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
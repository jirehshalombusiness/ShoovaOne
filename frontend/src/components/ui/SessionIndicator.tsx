import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { sessionService } from '@/services/session.service';
import { Clock, LogOut, TrendingUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function SessionIndicator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['session', 'status'],
    queryFn: () => sessionService.getStatus(),
    refetchInterval: 60_000, // refresh every minute
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!data?.has_attendance || data.status === 'ended') {
    return null;
  }

  const total = data.total_minutes;
  const standard = data.standard_minutes;
  const ot = data.overtime_minutes;
  const remaining = Math.max(0, 480 - standard);
  const pct = Math.min(100, (standard / 480) * 100);

  const statusColor =
    data.status === 'active'
      ? 'text-emerald-600'
      : data.status === 'idle'
      ? 'text-amber-600'
      : 'text-gray-500';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
      >
        <span className={cn('w-2 h-2 rounded-full', 
          data.status === 'active' ? 'bg-emerald-500 animate-pulse' :
          data.status === 'idle' ? 'bg-amber-500' : 'bg-gray-400'
        )} />
        <span className="text-[12px] font-semibold text-gray-900 tabular-nums">
          {formatMinutes(total)}
        </span>
        {ot > 0 && (
          <span className="text-[10px] font-bold text-amber-600">
            +{formatMinutes(ot)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Today
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {formatMinutes(total)}
            </div>
            <div className={cn('text-[11px] font-medium mt-0.5 capitalize', statusColor)}>
              ● {data.status}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Standard</span>
              <span className="font-semibold text-gray-900">{formatMinutes(standard)} / 8h</span>
            </div>
            {ot > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Overtime</span>
                <span className="font-semibold text-amber-600">{formatMinutes(ot)}</span>
              </div>
            )}
            {remaining > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Remaining</span>
                <span className="font-semibold text-gray-900">{formatMinutes(remaining)}</span>
              </div>
            )}

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  ot > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>

            {ot > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-md">
                <TrendingUp className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-[10px] text-amber-700">
                  You're in overtime. Consider checking out.
                </span>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/attendance');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Go to Attendance
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
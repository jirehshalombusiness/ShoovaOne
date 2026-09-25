import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { UserCheck, UserX, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RosterPerson {
  person_id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  department: string | null;
  profile_image_url: string | null;
  check_in: string | null;
  check_out: string | null;
  minutes_worked: number;
  status: 'checked_in' | 'checked_out' | 'not_checked_in';
}

interface RosterResponse {
  date: string;
  checked_in: RosterPerson[];
  not_checked_in: RosterPerson[];
}

export function WhosInToday() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'attendance-roster'],
    queryFn: () => hrService.getAttendanceRoster(),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="h-4 w-40 bg-gray-100 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Who's In Today
          </h3>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-semibold">
            {data.checked_in.length} / {data.checked_in.length + data.not_checked_in.length}
          </span>
        </div>
        <button
          onClick={() => navigate('/attendance')}
          className="text-xs font-medium text-primary hover:underline"
        >
          View attendance
        </button>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

        {/* Left — Checked In */}
        <div className="max-h-[360px] overflow-y-auto">
          <div className="px-4 py-2 bg-emerald-50/50 border-b border-emerald-100 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                Checked In ({data.checked_in.length})
              </span>
            </div>
          </div>

          {data.checked_in.length === 0 ? (
            <div className="text-center py-10 px-4">
              <UserX className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Nobody has checked in yet today
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.checked_in.map((person) => (
                <CheckedInRow
                  key={person.person_id}
                  person={person}
                  onClick={() => navigate(`/hr/employees/${person.person_id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right — Not Checked In */}
        <div className="max-h-[360px] overflow-y-auto">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
                Not Checked In ({data.not_checked_in.length})
              </span>
            </div>
          </div>

          {data.not_checked_in.length === 0 ? (
            <div className="text-center py-10 px-4">
              <UserCheck className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                Everyone has checked in
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.not_checked_in.map((person) => (
                <NotCheckedInRow
                  key={person.person_id}
                  person={person}
                  onClick={() => navigate(`/hr/employees/${person.person_id}`)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ============================================================
// ROWS
// ============================================================

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function CheckedInRow({
  person,
  onClick,
}: {
  person: RosterPerson;
  onClick: () => void;
}) {
  const isCheckedOut = person.status === 'checked_out';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="relative flex-shrink-0">
        <Avatar
          firstName={person.first_name}
          lastName={person.last_name}
          imageUrl={person.profile_image_url}
          size="md"
        />
        {!isCheckedOut && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 truncate">
          {person.first_name} {person.last_name}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
          {person.job_title && (
            <span className="truncate">{person.job_title}</span>
          )}
          {person.department && !person.job_title && (
            <span className="truncate">{person.department}</span>
          )}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <div className="text-[12px] font-semibold text-gray-900 tabular-nums">
          {formatDuration(person.minutes_worked)}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5 justify-end">
          <Clock className="w-2.5 h-2.5" />
          {person.check_in &&
            format(new Date(person.check_in), 'h:mm a')}
          {isCheckedOut && person.check_out && (
            <>
              {' · '}
              {format(new Date(person.check_out), 'h:mm a')}
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function NotCheckedInRow({
  person,
  onClick,
}: {
  person: RosterPerson;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left opacity-70 hover:opacity-100"
    >
      <Avatar
        firstName={person.first_name}
        lastName={person.last_name}
        imageUrl={person.profile_image_url}
        size="md"
        className="grayscale"
      />

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-700 truncate">
          {person.first_name} {person.last_name}
        </div>
        <div className="text-[11px] text-gray-400 truncate mt-0.5">
          {person.job_title ?? person.department ?? '—'}
        </div>
      </div>

      <span className="text-[10px] font-medium text-gray-400 flex-shrink-0">
        Not in
      </span>
    </button>
  );
}
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  attendanceService,
  AssignedTask,
  CheckOutBreakdown,
} from '@/services/attendance.service';
import { sessionService } from '@/services/session.service';
import { CheckInModal } from '@/features/attendance/components/CheckInModal';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle,
  PlayCircle,
  X,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

function formatMinutes(total: number | null | undefined) {
  const safe = Math.max(0, Math.round(total ?? 0));
  return `${Math.floor(safe / 60)}h ${safe % 60}m`;
}

export function AttendancePage() {
  const queryClient = useQueryClient();
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  const { data: today, refetch } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceService.getToday(),
    refetchInterval: 60_000,
  });

  const { data: session } = useQuery({
    queryKey: ['session', 'status'],
    queryFn: () => sessionService.getStatus(),
    enabled: !!today?.check_in && !today?.check_out,
    refetchInterval: 60_000,
  });

  const isCheckedIn = today?.check_in && !today?.check_out;
  const isCheckedOut = today?.check_in && today?.check_out;

  const workedMinutes =
    session?.effective_minutes ?? today?.effective_minutes ?? 0;
  const elapsedMinutes =
    session?.elapsed_minutes ?? today?.elapsed_minutes ?? 0;
  const idleMinutes = session?.idle_minutes ?? today?.idle_minutes ?? 0;

  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['session', 'status'] });
    queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
  };

  const resumeMutation = useMutation({
    mutationFn: () => sessionService.start(),
    onSuccess: () => {
      toast.success('Day resumed — time tracking is active again');
      refresh();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Could not resume the day'),
  });

  return (
    <div className="space-y-6 max-w-8xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center',
                isCheckedOut
                  ? 'bg-emerald-50'
                  : isCheckedIn
                    ? 'bg-blue-50'
                    : 'bg-gray-100'
              )}
            >
              <Clock
                className={cn(
                  'w-6 h-6',
                  isCheckedOut
                    ? 'text-emerald-600'
                    : isCheckedIn
                      ? 'text-blue-600'
                      : 'text-gray-500'
                )}
                strokeWidth={1.75}
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Today's Status</h3>
              {isCheckedOut ? (
                <p className="text-sm text-emerald-600 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-4 h-4" /> Completed —{' '}
                  {formatMinutes(today?.duration_minutes)}
                </p>
              ) : isCheckedIn ? (
                <p className="text-sm text-blue-600 flex items-center gap-1 mt-0.5">
                  <Clock className="w-4 h-4" /> Checked in at{' '}
                  {format(new Date(today!.check_in!), 'h:mm a')} ·{' '}
                  {formatMinutes(workedMinutes)} worked
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-0.5">
                  Not checked in yet
                </p>
              )}
              {isCheckedIn && idleMinutes > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {formatMinutes(idleMinutes)} idle excluded from paid time
                </p>
              )}
              {isCheckedIn && idleMinutes === 0 && elapsedMinutes > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {formatMinutes(elapsedMinutes)} since check-in
                </p>
              )}
              {today?.adhoc_tasks && today.adhoc_tasks.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {today.adhoc_tasks.length} ad-hoc task
                  {today.adhoc_tasks.length !== 1 ? 's' : ''} added today
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {!today?.check_in && (
              <button
                onClick={() => setShowCheckInModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Check In
              </button>
            )}
            {isCheckedIn && today?.current_status !== 'active' && (
              <button
                onClick={() => resumeMutation.mutate()}
                disabled={resumeMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <PlayCircle className="w-4 h-4" />
                {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
              </button>
            )}
            {isCheckedIn && (
              <button
                onClick={() => setShowCheckOutModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Check Out
              </button>
            )}
            {isCheckedOut && (
              <div className="text-sm text-gray-500 px-4 py-2 bg-gray-50 rounded-md">
                Complete for today ✓
              </div>
            )}
          </div>
        </div>
      </div>

      {/* This week summary */}
      <WeekSummary />

      {/* Modals */}
      {showCheckInModal && (
        <CheckInModal
          onCheckedIn={() => {
            setShowCheckInModal(false);
            refresh();
          }}
          onDismiss={() => setShowCheckInModal(false)}
        />
      )}

      {showCheckOutModal && (
        <CheckOutModal
          workedMinutes={workedMinutes}
          elapsedMinutes={elapsedMinutes}
          idleMinutes={idleMinutes}
          plannedTaskIds={today?.planned_task_ids || []}
          assignedTasks={today?.assigned_tasks || []}
          onClose={() => setShowCheckOutModal(false)}
          onSuccess={() => {
            setShowCheckOutModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

/* ==================== CHECK-OUT MODAL ==================== */

function CheckOutModal({
  workedMinutes,
  elapsedMinutes,
  idleMinutes,
  plannedTaskIds,
  assignedTasks,
  onClose,
  onSuccess,
}: {
  workedMinutes: number;
  elapsedMinutes: number;
  idleMinutes: number;
  plannedTaskIds: string[];
  assignedTasks: AssignedTask[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const workedHours = Math.max(0, Math.round((workedMinutes / 60) * 10) / 10);
  const regularHours = Math.min(workedHours, 8);
  const overtimeHours = Math.max(0, Math.round((workedHours - 8) * 10) / 10);

  // Planned tasks the user selected at check-in
  const plannedTasks = assignedTasks.filter((t) => plannedTaskIds.includes(t.id));

  // If no planned tasks, create a "general work" bucket. The breakdown
  // covers regular hours only; overtime is recorded separately.
  const initial: CheckOutBreakdown[] =
    plannedTasks.length > 0
      ? plannedTasks.map((t) => ({
          task_id: t.id,
          hours: Math.round((regularHours / plannedTasks.length) * 10) / 10,
          completed: false,
        }))
      : [
          {
            task_id: null,
            hours: regularHours,
            completed: false,
            description: 'General work',
          },
        ];

  const [breakdown, setBreakdown] = useState<CheckOutBreakdown[]>(initial);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      attendanceService.checkOut({
        task_breakdown: breakdown,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Checked out — effective time sent to your timesheet');
      onSuccess();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Check-out failed'),
  });

  const updateHours = (i: number, hours: number) =>
    setBreakdown(breakdown.map((b, idx) => (idx === i ? { ...b, hours } : b)));

  const toggleCompleted = (i: number) =>
    setBreakdown(
      breakdown.map((b, idx) =>
        idx === i ? { ...b, completed: !b.completed } : b
      )
    );

  const sumHours = breakdown.reduce((s, b) => s + b.hours, 0);
  const diff = regularHours - sumHours;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Check Out</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              You worked {formatMinutes(workedMinutes)} today.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 rounded-md bg-gray-50 text-xs text-gray-600">
            <span>
              Worked <strong>{formatMinutes(workedMinutes)}</strong>
            </span>
            <span>
              Since check-in <strong>{formatMinutes(elapsedMinutes)}</strong>
            </span>
            {idleMinutes > 0 && (
              <span className="text-amber-700">
                Idle <strong>{formatMinutes(idleMinutes)}</strong> excluded
              </span>
            )}
          </div>

          {overtimeHours > 0 && (
            <div className="px-3 py-2 rounded-md bg-blue-50 text-xs text-blue-700">
              {overtimeHours.toFixed(1)}h overtime will be added as a separate
              entry (regular time is capped at 8h).
            </div>
          )}

          {breakdown.map((entry, i) => {
            const task = plannedTasks.find((t) => t.id === entry.task_id);
            const title = task ? task.title : entry.description || 'General work';
            const project = task?.project_name;

            return (
              <div
                key={i}
                className="p-3 border border-gray-200 rounded-md space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {title}
                    </div>
                    {project && (
                      <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-2.5 h-2.5" />
                        {project}
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.completed}
                      onChange={() => toggleCompleted(i)}
                      className="accent-emerald-600"
                    />
                    <span className="text-xs text-gray-600">Complete</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Hours:</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={entry.hours}
                    onChange={(e) =>
                      updateHours(i, parseFloat(e.target.value) || 0)
                    }
                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            );
          })}

          <div
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-md text-sm',
              Math.abs(diff) < 0.1
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            )}
          >
            <span className="font-medium">
              Regular: {sumHours.toFixed(1)}h / {regularHours.toFixed(1)}h
            </span>
            {Math.abs(diff) >= 0.1 ? (
              <span className="text-xs">
                {diff > 0
                  ? `${diff.toFixed(1)}h unaccounted`
                  : `${Math.abs(diff).toFixed(1)}h over`}
              </span>
            ) : overtimeHours > 0 ? (
              <span className="text-xs">
                + {overtimeHours.toFixed(1)}h overtime
              </span>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context for today?"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-md text-xs text-blue-700">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Only heartbeat-covered time is paid. Idle gaps are excluded and
              confirmed time is locked into your weekly timesheet.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || Math.abs(diff) >= 0.5}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Confirm & Submit Time'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== WEEK SUMMARY ==================== */

function WeekSummary() {
  // Placeholder — we'll enhance later
  return null;
}

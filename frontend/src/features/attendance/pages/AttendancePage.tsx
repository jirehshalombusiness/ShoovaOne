import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService, AssignedTask, CheckOutBreakdown } from '@/services/attendance.service';
import { useAuth } from '@/lib/auth';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle,
  Plus,
  X,
  Briefcase,
  User,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  const { data: today, isLoading, refetch } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceService.getToday(),
    refetchInterval: 60_000, // refresh every minute
  });

  const isCheckedIn = today?.check_in && !today?.check_out;
  const isCheckedOut = today?.check_in && today?.check_out;

  return (
    <div className="space-y-6 max-w-4xl">
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
            <div className={cn(
              'w-14 h-14 rounded-full flex items-center justify-center',
              isCheckedOut ? 'bg-emerald-50' : isCheckedIn ? 'bg-blue-50' : 'bg-gray-100'
            )}>
              <Clock className={cn(
                'w-6 h-6',
                isCheckedOut ? 'text-emerald-600' : isCheckedIn ? 'text-blue-600' : 'text-gray-500'
              )} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Today's Status</h3>
              {isCheckedOut ? (
                <p className="text-sm text-emerald-600 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="w-4 h-4" /> Completed — {Math.floor((today?.duration_minutes ?? 0) / 60)}h {today?.duration_minutes! % 60}m
                </p>
              ) : isCheckedIn ? (
                <p className="text-sm text-blue-600 flex items-center gap-1 mt-0.5">
                  <Clock className="w-4 h-4" /> Checked in at {format(new Date(today!.check_in!), 'h:mm a')}
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-0.5">Not checked in yet</p>
              )}
              {today?.adhoc_tasks && today.adhoc_tasks.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {today.adhoc_tasks.length} ad-hoc task{today.adhoc_tasks.length !== 1 ? 's' : ''} added today
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
          assignedTasks={today?.assigned_tasks || []}
          onClose={() => setShowCheckInModal(false)}
          onSuccess={() => {
            setShowCheckInModal(false);
            refetch();
          }}
        />
      )}

      {showCheckOutModal && (
        <CheckOutModal
          checkIn={today!.check_in!}
          plannedTaskIds={today?.planned_task_ids || []}
          assignedTasks={today?.assigned_tasks || []}
          onClose={() => setShowCheckOutModal(false)}
          onSuccess={() => {
            setShowCheckOutModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/* ==================== CHECK-IN MODAL ==================== */

function CheckInModal({
  assignedTasks,
  onClose,
  onSuccess,
}: {
  assignedTasks: AssignedTask[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [adhocTasks, setAdhocTasks] = useState<{ title: string; priority: string }[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      attendanceService.checkIn({
        planned_task_ids: selected,
        adhoc_tasks: adhocTasks,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Checked in for today');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Check-in failed'),
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const addAdhoc = () => {
    if (!newTitle.trim()) return;
    setAdhocTasks([...adhocTasks, { title: newTitle.trim(), priority: newPriority }]);
    setNewTitle('');
    setNewPriority('medium');
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Check In</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              What are you working on today?
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Assigned tasks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Assigned to you
            </label>
            {assignedTasks.length === 0 ? (
              <div className="text-xs text-gray-400 py-3">
                No assigned tasks — add something below
              </div>
            ) : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {assignedTasks.map((task) => (
                  <label
                    key={task.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors',
                      selected.includes(task.id)
                        ? 'bg-primary/5 border border-primary/30'
                        : 'border border-gray-200 hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(task.id)}
                      onChange={() => toggle(task.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.project_name ? (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Briefcase className="w-2.5 h-2.5" />
                            {task.project_name}
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold uppercase tracking-wider">
                            Personal
                          </span>
                        )}
                        {task.due_date && (
                          <span className="text-[10px] text-gray-500">
                            Due {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Ad-hoc tasks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Add something new
            </label>
            {adhocTasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {adhocTasks.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-md"
                  >
                    <span className="text-xs text-gray-900 truncate">{t.title}</span>
                    <button
                      onClick={() => setAdhocTasks(adhocTasks.filter((_, idx) => idx !== i))}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAdhoc();
                  }
                }}
                placeholder="e.g., Research competitor X"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="px-2 py-2 border border-gray-200 rounded-md text-xs focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Med</option>
                <option value="high">High</option>
              </select>
              <button
                type="button"
                onClick={addAdhoc}
                disabled={!newTitle.trim()}
                className="px-3 py-2 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notes */}
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
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {mutation.isPending ? 'Checking in...' : 'Confirm Check-In'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== CHECK-OUT MODAL ==================== */

function CheckOutModal({
  checkIn,
  plannedTaskIds,
  assignedTasks,
  onClose,
  onSuccess,
}: {
  checkIn: string;
  plannedTaskIds: string[];
  assignedTasks: AssignedTask[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const totalHours = Math.max(
    0.5,
    Math.round(((Date.now() - new Date(checkIn).getTime()) / 3_600_000) * 10) / 10
  );

  // Planned tasks the user selected at check-in
  const plannedTasks = assignedTasks.filter((t) => plannedTaskIds.includes(t.id));

  // If no planned tasks, create a "general work" bucket
  const initial: CheckOutBreakdown[] = plannedTasks.length > 0
    ? plannedTasks.map((t) => ({
        task_id: t.id,
        hours: Math.round((totalHours / plannedTasks.length) * 10) / 10,
        completed: false,
      }))
    : [{ task_id: null, hours: totalHours, completed: false, description: 'General work' }];

  const [breakdown, setBreakdown] = useState<CheckOutBreakdown[]>(initial);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      attendanceService.checkOut({
        task_breakdown: breakdown,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Checked out — time submitted to timesheet');
      onSuccess();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Check-out failed'),
  });

  const updateHours = (i: number, hours: number) =>
    setBreakdown(breakdown.map((b, idx) => (idx === i ? { ...b, hours } : b)));

  const toggleCompleted = (i: number) =>
    setBreakdown(breakdown.map((b, idx) => (idx === i ? { ...b, completed: !b.completed } : b)));

  const sumHours = breakdown.reduce((s, b) => s + b.hours, 0);
  const diff = totalHours - sumHours;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Check Out</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              You worked ~{totalHours}h today. Confirm your task breakdown.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                    <div className="text-sm font-medium text-gray-900">{title}</div>
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
                    onChange={(e) => updateHours(i, parseFloat(e.target.value) || 0)}
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
              Total: {sumHours.toFixed(1)}h / {totalHours}h
            </span>
            {Math.abs(diff) >= 0.1 && (
              <span className="text-xs">
                {diff > 0 ? `${diff.toFixed(1)}h unaccounted` : `${Math.abs(diff).toFixed(1)}h over`}
              </span>
            )}
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
              Confirmed time is locked and added to your weekly timesheet. You can adjust before submitting.
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
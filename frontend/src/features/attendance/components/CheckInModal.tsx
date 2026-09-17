import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';
import { sessionService } from '@/services/session.service';
import {
  Building2,
  MapPin,
  Plus,
  X,
  Briefcase,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

const WORK_TYPES = [
  {
    value: 'office',
    icon: Building2,
    label: 'Office Work',
    description: 'Time auto-tracked via activity',
  },
  {
    value: 'remote',
    icon: Clock,
    label: 'Remote Work',
    description: 'Working from home',
  },
  {
    value: 'field',
    icon: MapPin,
    label: 'Field Work',
    description: 'Visiting partners, events',
  },
];

export function CheckInModal({ onCheckedIn }: { onCheckedIn: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [workType, setWorkType] = useState('office');
  const [adhocTasks, setAdhocTasks] = useState<{ title: string; priority: string }[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');

  const { data: today } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceService.getToday(),
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      await attendanceService.checkIn({
        planned_task_ids: selected,
        adhoc_tasks: adhocTasks,
        work_type: workType,
      });
      // Start the first work session
      await sessionService.start();
    },
    onSuccess: () => {
      toast.success('Checked in — your day has started');
      onCheckedIn();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Check-in failed'),
  });

  const assignedTasks = today?.assigned_tasks || [];

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const addAdhoc = () => {
    if (!newTitle.trim()) return;
    setAdhocTasks([...adhocTasks, { title: newTitle.trim(), priority: newPriority }]);
    setNewTitle('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Welcome back</h2>
          <p className="text-sm text-gray-500 mt-1">
            Start your day. Your time will be tracked while you're active.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Work type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              What kind of work today?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WORK_TYPES.map((wt) => {
                const Icon = wt.icon;
                const active = workType === wt.value;
                return (
                  <button
                    key={wt.value}
                    type="button"
                    onClick={() => setWorkType(wt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-md border transition-colors',
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-4 h-4',
                        active ? 'text-primary' : 'text-gray-500'
                      )}
                      strokeWidth={1.75}
                    />
                    <span
                      className={cn(
                        'text-[10px] font-semibold',
                        active ? 'text-primary' : 'text-gray-700'
                      )}
                    >
                      {wt.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              {WORK_TYPES.find((w) => w.value === workType)?.description}
            </p>
          </div>

          {/* Assigned tasks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Working on today
            </label>
            {assignedTasks.length === 0 ? (
              <div className="text-xs text-gray-400 py-3">
                No assigned tasks — add one below
              </div>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {assignedTasks.map((task: any) => (
                  <label
                    key={task.id}
                    className={cn(
                      'flex items-start gap-3 p-2.5 rounded-md cursor-pointer transition-colors',
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
                      <div className="text-sm font-medium text-gray-900">
                        {task.title}
                      </div>
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
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Add ad-hoc */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Or add something new
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
                      onClick={() =>
                        setAdhocTasks(adhocTasks.filter((_, idx) => idx !== i))
                      }
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
                placeholder="e.g., Review EPA proposal"
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <CheckCircle2 className="w-3 h-3" />
            Time tracked automatically
          </div>
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending}
            className="px-5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {checkInMutation.isPending ? 'Starting...' : 'Start My Day'}
          </button>
        </div>
      </div>
    </div>
  );
}
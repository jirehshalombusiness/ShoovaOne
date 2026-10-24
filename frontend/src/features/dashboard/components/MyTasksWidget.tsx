import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, isBefore, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import {
  CheckSquare,
  CheckCircle2,
  Circle,
  ArrowRight,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { myWorkService } from '@/services/mywork.service';
import { taskService } from '@/services/task.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

const priorityDot: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
};

export function MyTasksWidget() {
  const navigate = useNavigate();
  const access = useHRAccess();
  const queryClient = useQueryClient();

  const canOpen = access.has('tasks.view');
  const canEdit = access.has('tasks.edit');

  const { data, isLoading } = useQuery({
    queryKey: ['my-work', 'tasks', 'all'],
    queryFn: () => myWorkService.getTasks('all'),
    refetchInterval: 60_000,
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) =>
      taskService.updateStandalone(taskId, { status: 'done' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work'] });
      toast.success('Task completed');
    },
    onError: () => {
      toast.error('Could not complete the task');
    },
  });

  const tasks = (data ?? []).slice(0, 6);
  const today = startOfDay(new Date());

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">My Tasks</h3>
          {data && data.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {data.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate(canOpen ? '/tasks' : '/my-work')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-11 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 h-full">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-gray-700">No open tasks</p>
            <p className="text-xs text-gray-500 mt-1">
              Everything assigned to you is done
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => {
              const due = task.due_date ? new Date(task.due_date) : null;
              const overdue = due ? isBefore(due, today) : false;
              const dueToday = due ? format(due, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') : false;

              return (
                <div
                  key={task.id}
                  className="group flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  {canEdit ? (
                    <button
                      onClick={() =>
                        !completeMutation.isPending &&
                        completeMutation.mutate(task.id)
                      }
                      disabled={completeMutation.isPending}
                      title="Mark as done"
                      className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-emerald-500 transition-colors"
                    >
                      <Circle className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  ) : (
                    <Circle
                      className="mt-0.5 w-4 h-4 flex-shrink-0 text-gray-200"
                      strokeWidth={1.75}
                    />
                  )}

                  <button
                    onClick={() => canOpen && navigate(`/tasks/${task.id}`)}
                    disabled={!canOpen}
                    className={cn(
                      'flex-1 min-w-0 text-left',
                      canOpen ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-1.5 h-1.5 rounded-full flex-shrink-0',
                          priorityDot[task.priority] ?? priorityDot.medium,
                        )}
                      />
                      <span className="text-[13px] font-medium text-gray-900 truncate">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 ml-3.5 text-[11px]">
                      {due ? (
                        <span
                          className={cn(
                            'flex items-center gap-1',
                            overdue
                              ? 'text-red-600 font-medium'
                              : dueToday
                                ? 'text-amber-600 font-medium'
                                : 'text-gray-500',
                          )}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {overdue
                            ? `Overdue ${format(due, 'MMM d')}`
                            : dueToday
                              ? 'Due today'
                              : `Due ${format(due, 'MMM d')}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">No due date</span>
                      )}
                      <span className="text-gray-300 capitalize">·</span>
                      <span className="text-gray-400 capitalize">
                        {task.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>

                  {canOpen && (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

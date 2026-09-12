import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService, Task } from '@/services/task.service';
import { peopleService } from '@/services/people.service';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar } from '@/components/ui/Avatar';
import {
  Plus,
  X,
  Calendar,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'react-hot-toast';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-400' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'blocked', label: 'Blocked', color: 'bg-red-500' },
  { id: 'review', label: 'Review', color: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' },
];

export function ProjectTasks() {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => taskService.getByProject(projectId!),
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      taskService.update(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
    onError: () => toast.error('Failed to update task'),
  });

  const groupedTasks = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    COLUMNS.forEach((col) => (grouped[col.id] = []));
    tasks?.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      } else {
        grouped['todo'].push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnId: string) => {
    if (!draggedTaskId) return;
    const task = tasks?.find((t) => t.id === draggedTaskId);
    if (!task || task.status === columnId) {
      setDraggedTaskId(null);
      return;
    }
    updateMutation.mutate({ taskId: draggedTaskId, data: { status: columnId } });
    setDraggedTaskId(null);
  };

  const canCreate = hasPermission('tasks.create');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {tasks?.length ?? 0} {tasks?.length === 1 ? 'task' : 'tasks'} across {COLUMNS.length} columns
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNewTaskModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        )}
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 min-h-[500px] pb-4">
          {COLUMNS.map((column) => (
            <div
              key={column.id}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
              className={cn(
                'flex-shrink-0 w-[280px] flex flex-col bg-gray-50/70 rounded-lg border border-gray-200 transition-colors',
                draggedTaskId && 'border-dashed border-primary/40 bg-primary/5'
              )}
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200">
                <div className={cn('w-2 h-2 rounded-full', column.color)} />
                <span className="text-[12px] font-semibold text-gray-700">
                  {column.label}
                </span>
                <span className="text-[10px] font-semibold text-gray-500 bg-white px-1.5 py-0.5 rounded min-w-[20px] text-center border border-gray-200">
                  {groupedTasks[column.id]?.length ?? 0}
                </span>
              </div>

              {/* Column body */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {groupedTasks[column.id]?.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-gray-400">
                    No tasks
                  </div>
                ) : (
                  groupedTasks[column.id].map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        'bg-white border border-gray-200 rounded-md p-3 cursor-pointer hover:border-primary hover:shadow-sm transition-all',
                        draggedTaskId === task.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <PriorityPill priority={task.priority} />
                        <button className="p-0.5 rounded hover:bg-gray-100 transition-colors">
                          <MoreHorizontal className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>

                      <h4 className="text-[12px] font-medium text-gray-900 leading-snug line-clamp-2 mb-2">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-[10px] text-gray-500 line-clamp-2 mb-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                        {task.assignee_id ? (
                          <Avatar
                            firstName={task.assignee_first_name}
                            lastName={task.assignee_last_name}
                            imageUrl={task.assignee_image_url}
                            size="xs"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-100 border border-dashed border-gray-300" />
                        )}

                        {task.due_date && (
                          <span
                            className={cn(
                              'text-[10px] flex items-center gap-1',
                              isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done'
                                ? 'text-red-600 font-medium'
                                : 'text-gray-500'
                            )}
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <NewTaskModal
          projectId={projectId!}
          onClose={() => setShowNewTaskModal(false)}
        />
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
        styles[priority] ?? styles.medium
      )}
    >
      {priority}
    </span>
  );
}

/* ========== NEW TASK MODAL ========== */

function NewTaskModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
  });

  const { data: people } = useQuery({
    queryKey: ['people'],
    queryFn: () => peopleService.getAll({ limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => taskService.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Task created');
      onClose();
    },
    onError: () => toast.error('Failed to create task'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      assignee_id: formData.assignee_id || null,
      due_date: formData.due_date || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">New Task</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              placeholder="Add details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Assignee
            </label>
            <select
              value={formData.assignee_id}
              onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Unassigned</option>
              {people?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.title.trim()}
              className="px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========== TASK DETAIL DRAWER ========== */

function TaskDetailDrawer({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { id: projectId } = useParams<{ id: string }>();

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) => taskService.update(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Task updated');
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => taskService.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      toast.success('Task deleted');
      onClose();
    },
  });

  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] bg-white z-50 flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Task Details</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>

          {task.description && (
            <p className="text-sm text-gray-600">{task.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {task.assignee_id && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Assignee
              </label>
              <div className="flex items-center gap-2">
                <Avatar
                  firstName={task.assignee_first_name}
                  lastName={task.assignee_last_name}
                  imageUrl={task.assignee_image_url}
                  size="sm"
                />
                <span className="text-sm text-gray-900">
                  {task.assignee_first_name} {task.assignee_last_name}
                </span>
              </div>
            </div>
          )}

          {task.due_date && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Due Date
              </label>
              <p className="text-sm text-gray-900">
                {format(new Date(task.due_date), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => {
              if (confirm('Delete this task?')) deleteMutation.mutate();
            }}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => updateMutation.mutate({ status, priority })}
              disabled={updateMutation.isPending}
              className="px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
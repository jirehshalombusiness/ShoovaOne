import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService, Task } from '@/services/task.service';
import { peopleService } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  ArrowLeft,
  Save,
  Trash2,
  CheckCircle2,
  Calendar,
  User,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

const { data: task, isLoading } = useQuery({
  queryKey: ['task', id],
  queryFn: () => taskService.getById(id!),
  enabled: !!id,
});

  const { data: people } = useQuery({
    queryKey: ['people', 'for-task-assignee'],
    queryFn: () => peopleService.getAll({ limit: 200 }),
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_id: '',
    due_date: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assignee_id: task.assignee_id || '',
        due_date: task.due_date || '',
      });
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => taskService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['my-work'] });
      toast.success('Task updated');
    },
    onError: () => toast.error('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => taskService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-work'] });
      toast.success('Task deleted');
      navigate('/my-work?tab=tasks');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      status: formData.status,
      priority: formData.priority,
      assignee_id: formData.assignee_id || null,
      due_date: formData.due_date || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Task not found</p>
      </div>
    );
  }

  const isProjectTask = !!task.project_id;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() =>
          isProjectTask
            ? navigate(`/projects/${task.project_id}/tasks`)
            : navigate('/my-work?tab=tasks')
        }
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {isProjectTask ? 'Back to project tasks' : 'Back to my tasks'}
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isProjectTask ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded uppercase tracking-wider">
                <Briefcase className="w-2.5 h-2.5" strokeWidth={2.5} />
                Project Task
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[9px] font-bold rounded uppercase tracking-wider">
                <User className="w-2.5 h-2.5" strokeWidth={2.5} />
                Personal Task
              </span>
            )}
            {task.completed_at && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded uppercase tracking-wider">
                <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2.5} />
                Completed
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
          {isProjectTask && (
            <button
              onClick={() => navigate(`/projects/${task.project_id}`)}
              className="text-xs text-primary hover:text-primary-dark transition-colors mt-1"
            >
              View project →
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-lg p-6 space-y-5"
      >
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            placeholder="Add more details..."
          />
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) =>
                setFormData({ ...formData, priority: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignee + Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Assignee
            </label>
            <select
              value={formData.assignee_id}
              onChange={(e) =>
                setFormData({ ...formData, assignee_id: e.target.value })
              }
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
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => {
              if (confirm('Delete this task?')) {
                deleteMutation.mutate();
              }
            }}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending || !formData.title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService, Project, Milestone } from '@/services/project.service';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Plus,
  Target,
  Check,
  Calendar,
  X,
  Circle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'react-hot-toast';

export function ProjectMilestones() {
  const { project } = useOutletContext<{ project: Project }>();
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  const canEdit = hasPermission('projects.edit');

  // Use project.milestones already loaded from ProjectLayout
  const milestones = project.milestones || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectService.deleteMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Milestone deleted');
    },
    onError: () => toast.error('Failed to delete milestone'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      projectService.updateMilestone(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Milestone updated');
    },
  });

  const completed = milestones.filter((m) => m.status === 'completed').length;
  const progressPct = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;

  return (
    <div className="max-w-9xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Milestones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {completed} of {milestones.length} complete ({progressPct}%)
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Milestone
          </button>
        )}
      </div>

      {/* Progress bar */}
      {milestones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">Overall Progress</span>
            <span className="text-xs font-bold text-gray-700">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Timeline */}
      {milestones.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No milestones yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add key dates and checkpoints for this project
          </p>
          {canEdit && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Milestone
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />

            <div className="space-y-6">
              {milestones.map((m) => {
                const isOverdue =
                  m.due_date &&
                  m.status !== 'completed' &&
                  isPast(new Date(m.due_date)) &&
                  !isToday(new Date(m.due_date));
                const isDueToday =
                  m.due_date && isToday(new Date(m.due_date)) && m.status !== 'completed';

                return (
                  <div key={m.id} className="relative flex gap-4 group">
                    {/* Icon */}
                    <button
                      onClick={() =>
                        canEdit &&
                        toggleMutation.mutate({
                          id: m.id,
                          status: m.status === 'completed' ? 'pending' : 'completed',
                        })
                      }
                      disabled={!canEdit}
                      className={cn(
                        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                        m.status === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : isOverdue
                          ? 'bg-red-100 text-red-600 border-2 border-white'
                          : isDueToday
                          ? 'bg-amber-100 text-amber-600 border-2 border-white'
                          : 'bg-white border-2 border-gray-200 text-gray-400 hover:border-primary hover:text-primary'
                      )}
                    >
                      {m.status === 'completed' ? (
                        <Check className="w-4 h-4" strokeWidth={2.5} />
                      ) : (
                        <Circle className="w-3 h-3" strokeWidth={2} />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3
                            className={cn(
                              'text-sm font-semibold text-gray-900',
                              m.status === 'completed' && 'line-through text-gray-400'
                            )}
                          >
                            {m.title}
                          </h3>
                          {m.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {m.description}
                            </p>
                          )}
                          {m.due_date && (
                            <div
                              className={cn(
                                'flex items-center gap-1.5 text-xs mt-2',
                                isOverdue
                                  ? 'text-red-600 font-medium'
                                  : isDueToday
                                  ? 'text-amber-600 font-medium'
                                  : 'text-gray-500'
                              )}
                            >
                              <Calendar className="w-3 h-3" />
                              {isOverdue
                                ? `Overdue — was due ${format(new Date(m.due_date), 'MMM d, yyyy')}`
                                : isDueToday
                                ? 'Due today'
                                : `Due ${format(new Date(m.due_date), 'MMM d, yyyy')}`}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingMilestone(m)}
                              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                              title="Edit"
                            >
                              <Target className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Delete this milestone?')) {
                                  deleteMutation.mutate(m.id);
                                }
                              }}
                              className="p-1.5 rounded hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* New Milestone Modal */}
      {showNewModal && (
        <MilestoneModal
          projectId={projectId!}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Edit Milestone Modal */}
      {editingMilestone && (
        <MilestoneModal
          projectId={projectId!}
          milestone={editingMilestone}
          onClose={() => setEditingMilestone(null)}
        />
      )}
    </div>
  );
}

function MilestoneModal({
  projectId,
  milestone,
  onClose,
}: {
  projectId: string;
  milestone?: Milestone;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: milestone?.title || '',
    description: milestone?.description || '',
    due_date: milestone?.due_date ? milestone.due_date.split('T')[0] : '',
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      milestone
        ? projectService.updateMilestone(milestone.id, data)
        : projectService.createMilestone(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success(milestone ? 'Milestone updated' : 'Milestone created');
      onClose();
    },
    onError: () => toast.error('Failed to save milestone'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      due_date: formData.due_date || null,
      status: milestone?.status || 'pending',
      position: milestone?.position || 0,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            {milestone ? 'Edit Milestone' : 'New Milestone'}
          </h3>
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
              placeholder="e.g., Site assessment complete"
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
              placeholder="Optional details..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
              disabled={saveMutation.isPending || !formData.title.trim()}
              className="px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : milestone ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
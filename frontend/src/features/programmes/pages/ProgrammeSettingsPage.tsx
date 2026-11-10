import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  programmesService,
  type ProgrammePayload,
  type ProgrammeStatus,
} from '@/services/programmes.service';
import { cn } from '@/lib/utils';
import { ProgrammeStatusBadge } from '../components/ProgrammeBadges';
import { ProgrammeForm } from '../components/ProgrammeForm';
import { useProgrammeWorkspace } from '../programmeWorkspace';

const STATUS_ACTIONS: Record<
  ProgrammeStatus,
  { label: string; status: ProgrammeStatus }[]
> = {
  draft: [
    { label: 'Activate', status: 'active' },
    { label: 'Archive', status: 'archived' },
  ],
  active: [
    { label: 'Mark completed', status: 'completed' },
    { label: 'Archive', status: 'archived' },
  ],
  completed: [{ label: 'Archive', status: 'archived' }],
  archived: [],
};

export function ProgrammeSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { programme, changeStatus, isChangingStatus } = useProgrammeWorkspace();

  const updateMutation = useMutation({
    mutationFn: (payload: ProgrammePayload) =>
      programmesService.update(programme.id, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['programmes', 'detail', programme.id], data);
      queryClient.invalidateQueries({ queryKey: ['programmes', 'list'] });
      toast.success('Programme updated');
      navigate(`/programmes/${programme.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update programme');
    },
  });

  const actions = STATUS_ACTIONS[programme.status];

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Programme status
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Drafts are hidden from everyone except programme managers
            </p>
          </div>
          <ProgrammeStatusBadge status={programme.status} />
        </div>

        {actions.length > 0 ? (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => changeStatus(action.status)}
                disabled={isChangingStatus}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50',
                  action.status === 'archived'
                    ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    : 'bg-primary text-white hover:bg-primary-dark',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-4">
            This programme is archived and can no longer be changed.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
          Edit programme
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 mb-4">
          Update the outline, lead and dates
        </p>
        <ProgrammeForm
          mode="edit"
          initial={programme}
          submitLabel="Save Changes"
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
          onCancel={() => navigate(`/programmes/${programme.id}`)}
        />
      </div>
    </div>
  );
}
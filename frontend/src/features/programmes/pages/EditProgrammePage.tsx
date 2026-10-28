import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  programmesService,
  type ProgrammePayload,
} from '@/services/programmes.service';
import { ProgrammeForm } from '../components/ProgrammeForm';

export function EditProgrammePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: programme, isLoading, error } = useQuery({
    queryKey: ['programmes', 'detail', id],
    queryFn: () => programmesService.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ProgrammePayload) =>
      programmesService.update(id!, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
      queryClient.setQueryData(['programmes', 'detail', id], data);
      toast.success('Programme updated');
      navigate(`/programmes/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update programme');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl p-6 space-y-4">
        <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !programme) {
    return (
      <div className="max-w-3xl p-6">
        <button
          onClick={() => navigate('/programmes')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Programmes
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load this programme
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {(error as Error)?.message ?? 'It may have been removed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl p-6 space-y-5">
      <button
        onClick={() => navigate(`/programmes/${programme.id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Programme
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Programme</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update the outline, lead and dates
        </p>
      </div>

      <ProgrammeForm
        mode="edit"
        initial={programme}
        submitLabel="Save Changes"
        isSubmitting={updateMutation.isPending}
        onSubmit={(payload) => updateMutation.mutate(payload)}
        onCancel={() => navigate(`/programmes/${programme.id}`)}
      />
    </div>
  );
}

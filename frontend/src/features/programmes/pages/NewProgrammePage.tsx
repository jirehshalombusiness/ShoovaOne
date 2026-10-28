import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  programmesService,
  type ProgrammePayload,
} from '@/services/programmes.service';
import { ProgrammeForm } from '../components/ProgrammeForm';

export function NewProgrammePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: ProgrammePayload) => programmesService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
      toast.success('Programme saved as draft');
      navigate(`/programmes/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create programme');
    },
  });

  return (
    <div className="max-w-3xl p-6 space-y-5">
      <button
        onClick={() => navigate('/programmes')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Programmes
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create a Programme</h1>
        <p className="text-sm text-gray-500 mt-1">
          Save the outline first, then build the curriculum and cohorts
        </p>
      </div>

      <ProgrammeForm
        mode="create"
        submitLabel="Save Draft"
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
        onCancel={() => navigate('/programmes')}
      />
    </div>
  );
}

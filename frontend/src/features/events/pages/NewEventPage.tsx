import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  eventsService,
  type CreateEventPayload,
} from '@/services/events.service';
import { EventForm } from '../components/EventForm';

export function NewEventPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateEventPayload) => eventsService.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event saved as draft');
      navigate(`/events/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create event');
    },
  });

  return (
    <div className="max-w-3xl p-6 space-y-5">
      <button
        onClick={() => navigate('/events')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create an Event</h1>
        <p className="text-sm text-gray-500 mt-1">
          Save it as a draft first, then publish it when the details are ready
        </p>
      </div>

      <EventForm
        submitLabel="Save Draft"
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutate(payload)}
        onCancel={() => navigate('/events')}
      />
    </div>
  );
}

import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  eventsService,
  type CreateEventPayload,
} from '@/services/events.service';
import { EventForm } from '../components/EventForm';

export function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['events', 'detail', id],
    queryFn: () => eventsService.get(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateEventPayload) =>
      eventsService.update(id!, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['events', 'detail', id] });
      toast.success('Event updated');
      navigate(`/events/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update event');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl p-6 space-y-4">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-3xl p-6 space-y-4">
        <button
          onClick={() => navigate('/events')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              Could not load this event
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
        onClick={() => navigate(`/events/${event.id}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Event
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Event</h1>
        <p className="text-sm text-gray-500 mt-1">
          Update the details for {event.title}
        </p>
      </div>

      <EventForm
        initial={event}
        submitLabel="Save Changes"
        isSubmitting={updateMutation.isPending}
        onSubmit={(payload) => updateMutation.mutate(payload)}
        onCancel={() => navigate(`/events/${event.id}`)}
      />
    </div>
  );
}

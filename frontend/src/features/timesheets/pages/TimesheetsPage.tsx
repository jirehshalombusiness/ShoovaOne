import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timesheetService } from '@/services/timesheet.service';
import { useAuth } from '@/lib/auth';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Send,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks, addWeeks, isSameDay } from 'date-fns';
import { toast } from 'react-hot-toast';

export function TimesheetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // Get timesheet for current week
  const { data: timesheet, isLoading, refetch, error } = useQuery({
    queryKey: ['timesheet', currentWeek],
    queryFn: () => timesheetService.getMyTimesheet(currentWeek.toISOString().split('T')[0]),
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  // Group entries by day
  const entriesByDay = (day: Date) => {
    if (!timesheet?.entries) return [];
    return timesheet.entries.filter(entry => 
      isSameDay(new Date(entry.date), day)
    );
  };

  // Calculate daily totals
  const dailyTotals = (day: Date) => {
    const entries = entriesByDay(day);
    return entries.reduce((sum, e) => sum + e.duration, 0);
  };

  // Create entry mutation
  const createMutation = useMutation({
    mutationFn: timesheetService.createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Entry added successfully');
      setShowEntryModal(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      console.error('Create error:', error);
      toast.error(error.response?.data?.detail || 'Failed to add entry');
    },
  });

  // Update entry mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      timesheetService.updateEntry(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Entry updated successfully');
      setShowEntryModal(false);
      setEditingEntry(null);
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update entry');
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: timesheetService.deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Entry deleted successfully');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete entry');
    },
  });

  // Submit timesheet mutation
  const submitMutation = useMutation({
    mutationFn: timesheetService.submitTimesheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Timesheet submitted for approval');
    },
    onError: (error: any) => {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit timesheet');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if timesheet exists
    if (!timesheet) {
      toast.error('No timesheet found. Please refresh and try again.');
      return;
    }

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const data = {
      timesheet_id: timesheet.id,
      date: formData.get('date') as string,
      duration: parseFloat(formData.get('duration') as string),
      project_id: formData.get('project_id') as string || undefined,
      task_id: formData.get('task_id') as string || undefined,
      start_time: formData.get('start_time') as string || undefined,
      end_time: formData.get('end_time') as string || undefined,
      break_minutes: parseInt(formData.get('break_minutes') as string) || 0,
      description: formData.get('description') as string || undefined,
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmitWeek = () => {
    if (!timesheet) {
      toast.error('No timesheet to submit');
      return;
    }

    if (window.confirm(`Submit timesheet for ${format(currentWeek, 'd MMM')} - ${format(addDays(currentWeek, 6), 'd MMM yyyy')}?\n\nTotal hours: ${timesheet?.total_hours || 0}h`)) {
      submitMutation.mutate(timesheet.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50';
      case 'submitted': return 'text-yellow-600 bg-yellow-50';
      case 'under_review': return 'text-blue-600 bg-blue-50';
      case 'rejected': return 'text-red-600 bg-red-50';
      case 'locked': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    console.error('Timesheet error:', error);
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load timesheet</p>
        <button 
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheets</h1>
          <p className="text-sm text-gray-500 mt-0.5">My Timesheet</p>
        </div>
        {timesheet && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(timesheet.status)}`}>
              {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}
            </span>
          </div>
        )}
      </div>

      {/* Week Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="text-center">
            <p className="font-medium text-gray-900">
              {format(currentWeek, 'd MMM')} – {format(addDays(currentWeek, 6), 'd MMM yyyy')}
            </p>
          </div>
          <button
            onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {timesheet && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Logged</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{timesheet.total_hours}h</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{timesheet.expected_hours}h</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Math.max(0, timesheet.expected_hours - timesheet.total_hours)}h
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Entries</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{timesheet.entries?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Weekly View - Day Headers */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDays.map((day) => (
            <div key={day.toString()} className="p-3 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase">
                {format(day, 'EEE')}
              </p>
              <p className={`text-lg font-semibold mt-0.5 ${
                isSameDay(day, new Date()) ? 'text-primary' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </p>
              {timesheet && (
                <p className="text-xs text-gray-500 mt-1">
                  {dailyTotals(day)}h
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Entries by Day */}
        <div className="divide-y divide-gray-100">
          {weekDays.map((day) => {
            const entries = entriesByDay(day);
            return (
              <div key={day.toString()} className="p-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {entries.length === 0 ? (
                      <p className="text-sm text-gray-400">No entries</p>
                    ) : (
                      <div className="space-y-2">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-3">
                              <span className="text-gray-500">
                                {entry.start_time && entry.end_time ? (
                                  `${entry.start_time.slice(0, 5)} - ${entry.end_time.slice(0, 5)}`
                                ) : (
                                  `${entry.duration}h`
                                )}
                              </span>
                              <span className="text-gray-700">{entry.description || 'No description'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingEntry(entry);
                                  setShowEntryModal(true);
                                }}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                <Edit2 className="h-3 w-3 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-1 rounded hover:bg-gray-200 transition-colors"
                              >
                                <Trash2 className="h-3 w-3 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm font-medium text-gray-700 ml-4">
                    {dailyTotals(day)}h
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => {
            setEditingEntry(null);
            setShowEntryModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          disabled={timesheet?.status === 'approved' || timesheet?.status === 'locked'}
        >
          <Plus className="h-4 w-4" />
          Add Time
        </button>

        {timesheet && (timesheet.status === 'draft' || timesheet.status === 'rejected') && (
          <button
            onClick={handleSubmitWeek}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Send className="h-4 w-4" />
            Submit Timesheet
          </button>
        )}
      </div>

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntry ? 'Edit Time Entry' : 'Add Time'}
              </h3>
              <button
                onClick={() => {
                  setShowEntryModal(false);
                  setEditingEntry(null);
                }}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  name="date"
                  defaultValue={editingEntry?.date || new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    name="start_time"
                    defaultValue={editingEntry?.start_time?.slice(0, 5) || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    name="end_time"
                    defaultValue={editingEntry?.end_time?.slice(0, 5) || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours) *</label>
                <input
                  type="number"
                  name="duration"
                  step="0.5"
                  defaultValue={editingEntry?.duration || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Break (minutes)</label>
                <input
                  type="number"
                  name="break_minutes"
                  defaultValue={editingEntry?.break_minutes || 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  name="description"
                  defaultValue={editingEntry?.description || ''}
                  placeholder="What did you work on?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  {editingEntry ? 'Update' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEntryModal(false);
                    setEditingEntry(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
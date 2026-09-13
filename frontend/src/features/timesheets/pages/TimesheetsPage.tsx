import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timesheetService, Timesheet } from '@/services/timesheet.service';
import { peopleService } from '@/services/people.service';
import { useAuth } from '@/lib/auth';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
  Edit2,
  Trash2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Eye,
  RotateCcw,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  addDays,
  subWeeks,
  addWeeks,
  isSameDay,
} from 'date-fns';
import { toast } from 'react-hot-toast';

type ViewMode = 'mine' | 'team';

type HistoryItem = {
  id?: string;
  action?: string;
  performed_by?: string | null;
  comment?: string | null;
  created_at?: string | null;
};

export function TimesheetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentWeek, setCurrentWeek] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const [viewMode, setViewMode] = useState<ViewMode>('mine');

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);

  const [selectedTimesheet, setSelectedTimesheet] =
    useState<Timesheet | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [returningTimesheetId, setReturningTimesheetId] =
    useState<string | null>(null);

  const [returnComment, setReturnComment] = useState('');

  /*
   * ---------------------------------------------------------
   * PERMISSIONS
   * ---------------------------------------------------------
   */

  const canApprove =
    user?.permissions?.includes('timesheets.approve') ?? false;

  /*
   * ---------------------------------------------------------
   * PEOPLE
   * ---------------------------------------------------------
   *
   * Used to turn person IDs returned by the timesheet API
   * into employee names.
   */

  const peopleQuery = useQuery({
    queryKey: ['people', 'timesheets'],
    queryFn: () => peopleService.getAll({ limit: 100 }),
    enabled: canApprove,
  });

  const peopleMap = useMemo(() => {
    const map = new Map<string, string>();

    for (const person of peopleQuery.data ?? []) {
      map.set(
        person.id,
        `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim()
      );
    }

    return map;
  }, [peopleQuery.data]);

  /*
   * ---------------------------------------------------------
   * CURRENT WEEK
   * ---------------------------------------------------------
   */

  const weekStart = currentWeek.toISOString().split('T')[0];

  const weekEnd = addDays(currentWeek, 6);

  /*
   * ---------------------------------------------------------
   * MY TIMESHEET
   * ---------------------------------------------------------
   */

  const {
    data: timesheet,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ['timesheet', weekStart],
    queryFn: () => timesheetService.getMyTimesheet(weekStart),
    enabled: viewMode === 'mine',
  });

  /*
   * ---------------------------------------------------------
   * TEAM TIMESHEETS
   * ---------------------------------------------------------
   */

  const {
    data: teamTimesheets = [],
    isLoading: teamLoading,
    error: teamError,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: ['team-timesheets', weekStart],
    queryFn: () => timesheetService.getTeamTimesheets(weekStart),
    enabled: viewMode === 'team' && canApprove,
  });

  /*
   * ---------------------------------------------------------
   * APPROVAL HISTORY
   * ---------------------------------------------------------
   */

  const {
    data: approvalHistory = [],
    isLoading: historyLoading,
  } = useQuery({
    queryKey: [
      'timesheet-history',
      selectedTimesheet?.id,
    ],
    queryFn: () =>
      timesheetService.getApprovalHistory(selectedTimesheet!.id),
    enabled: showHistoryModal && !!selectedTimesheet,
  });

  /*
   * ---------------------------------------------------------
   * WEEK DAYS
   * ---------------------------------------------------------
   */

  const weekDays = Array.from(
    { length: 7 },
    (_, i) => addDays(currentWeek, i)
  );

  /*
   * ---------------------------------------------------------
   * MY TIMESHEET HELPERS
   * ---------------------------------------------------------
   */

  const entriesByDay = (day: Date) => {
    if (!timesheet?.entries) return [];

    return timesheet.entries.filter((entry) =>
      isSameDay(new Date(entry.date), day)
    );
  };

  const dailyTotals = (day: Date) => {
    const entries = entriesByDay(day);

    return entries.reduce(
      (sum, entry) => sum + Number(entry.duration || 0),
      0
    );
  };

  /*
   * ---------------------------------------------------------
   * CREATE ENTRY
   * ---------------------------------------------------------
   */

  const createMutation = useMutation({
    mutationFn: timesheetService.createEntry,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timesheet'],
      });

      toast.success('Entry added successfully');

      setShowEntryModal(false);
      setEditingEntry(null);
    },

    onError: (error: any) => {
      console.error('Create error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to add entry'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * UPDATE ENTRY
   * ---------------------------------------------------------
   */

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: any;
    }) => timesheetService.updateEntry(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timesheet'],
      });

      toast.success('Entry updated successfully');

      setShowEntryModal(false);
      setEditingEntry(null);
    },

    onError: (error: any) => {
      console.error('Update error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to update entry'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * DELETE ENTRY
   * ---------------------------------------------------------
   */

  const deleteMutation = useMutation({
    mutationFn: timesheetService.deleteEntry,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timesheet'],
      });

      toast.success('Entry deleted successfully');
    },

    onError: (error: any) => {
      console.error('Delete error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to delete entry'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * SUBMIT TIMESHEET
   * ---------------------------------------------------------
   */

  const submitMutation = useMutation({
    mutationFn: timesheetService.submitTimesheet,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['timesheet'],
      });

      toast.success(
        'Timesheet submitted for approval'
      );
    },

    onError: (error: any) => {
      console.error('Submit error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to submit timesheet'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * APPROVE TIMESHEET
   * ---------------------------------------------------------
   */

  const approveMutation = useMutation({
    mutationFn: (timesheetId: string) =>
      timesheetService.approveTimesheet(
        timesheetId,
        'Timesheet approved'
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['team-timesheets'],
      });

      queryClient.invalidateQueries({
        queryKey: ['timesheet'],
      });

      queryClient.invalidateQueries({
        queryKey: ['timesheet-history'],
      });

      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });

      toast.success('Timesheet approved');
    },

    onError: (error: any) => {
      console.error('Approval error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to approve timesheet'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * RETURN TIMESHEET
   * ---------------------------------------------------------
   */

  const returnMutation = useMutation({
    mutationFn: ({
      timesheetId,
      comment,
    }: {
      timesheetId: string;
      comment: string;
    }) =>
      timesheetService.returnTimesheet(
        timesheetId,
        comment
      ),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['team-timesheets'],
      });

      queryClient.invalidateQueries({
        queryKey: ['timesheet-history'],
      });

      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });

      toast.success(
        'Timesheet returned to employee'
      );

      setReturningTimesheetId(null);
      setReturnComment('');
    },

    onError: (error: any) => {
      console.error('Return error:', error);

      toast.error(
        error.response?.data?.detail ||
          'Failed to return timesheet'
      );
    },
  });

  /*
   * ---------------------------------------------------------
   * FORM HANDLERS
   * ---------------------------------------------------------
   */

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!timesheet) {
      toast.error(
        'No timesheet found. Please refresh and try again.'
      );
      return;
    }

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data = {
      timesheet_id: timesheet.id,
      date: formData.get('date') as string,
      duration: parseFloat(
        formData.get('duration') as string
      ),
      project_id:
        (formData.get('project_id') as string) ||
        undefined,
      task_id:
        (formData.get('task_id') as string) ||
        undefined,
      start_time:
        (formData.get('start_time') as string) ||
        undefined,
      end_time:
        (formData.get('end_time') as string) ||
        undefined,
      break_minutes:
        parseInt(
          formData.get('break_minutes') as string
        ) || 0,
      description:
        (formData.get('description') as string) ||
        undefined,
    };

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        data,
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (
      window.confirm(
        'Are you sure you want to delete this entry?'
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmitWeek = () => {
    if (!timesheet) {
      toast.error('No timesheet to submit');
      return;
    }

    const confirmed = window.confirm(
      `Submit timesheet for ${format(
        currentWeek,
        'd MMM'
      )} - ${format(
        weekEnd,
        'd MMM yyyy'
      )}?\n\nTotal hours: ${
        timesheet.total_hours || 0
      }h`
    );

    if (confirmed) {
      submitMutation.mutate(timesheet.id);
    }
  };

  /*
   * ---------------------------------------------------------
   * APPROVAL HANDLERS
   * ---------------------------------------------------------
   */

  const handleApprove = (item: Timesheet) => {
    const employeeName =
      peopleMap.get(item.person_id) ||
      'this employee';

    const confirmed = window.confirm(
      `Approve ${employeeName}'s timesheet?\n\n` +
        `Total hours: ${item.total_hours}h\n` +
        `Week: ${format(
          new Date(item.week_start_date),
          'd MMM'
        )} - ${format(
          new Date(item.week_end_date),
          'd MMM yyyy'
        )}`
    );

    if (confirmed) {
      approveMutation.mutate(item.id);
    }
  };

  const handleReturn = () => {
    if (!returningTimesheetId) return;

    const comment = returnComment.trim();

    if (!comment) {
      toast.error(
        'Please provide a reason for returning the timesheet'
      );
      return;
    }

    returnMutation.mutate({
      timesheetId: returningTimesheetId,
      comment,
    });
  };

  /*
   * ---------------------------------------------------------
   * DISPLAY HELPERS
   * ---------------------------------------------------------
   */

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-700 bg-green-50 border-green-100';

      case 'submitted':
        return 'text-yellow-700 bg-yellow-50 border-yellow-100';

      case 'under_review':
        return 'text-blue-700 bg-blue-50 border-blue-100';

      case 'rejected':
        return 'text-red-700 bg-red-50 border-red-100';

      case 'locked':
        return 'text-gray-700 bg-gray-50 border-gray-100';

      default:
        return 'text-gray-700 bg-gray-50 border-gray-100';
    }
  };

  const formatStatus = (status: string) => {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const getPersonName = (personId: string) => {
    return (
      peopleMap.get(personId) ||
      'Employee'
    );
  };

  const getActionLabel = (action?: string) => {
    if (!action) return 'Activity';

    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const getHistoryPersonName = (
    performedBy?: string | null
  ) => {
    if (!performedBy) return 'System';

    return (
      peopleMap.get(performedBy) ||
      performedBy
    );
  };

  /*
   * ---------------------------------------------------------
   * LOADING / ERROR
   * ---------------------------------------------------------
   */

  if (
    viewMode === 'mine' &&
    isLoading
  ) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * MAIN PAGE
   * ---------------------------------------------------------
   */

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex items-start justify-between gap-4 flex-wrap">

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Timesheets
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            {viewMode === 'mine'
              ? 'Track and submit your working hours'
              : 'Review and manage team timesheets'}
          </p>
        </div>

        {viewMode === 'mine' && timesheet && (
          <span
            className={`px-3 py-1.5 rounded-full border text-xs font-medium ${getStatusColor(
              timesheet.status
            )}`}
          >
            {formatStatus(timesheet.status)}
          </span>
        )}
      </div>

      {/* =====================================================
          VIEW TABS
      ====================================================== */}

      <div className="bg-white border border-gray-200 rounded-lg p-1 inline-flex">

        <button
          onClick={() => setViewMode('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'mine'
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="h-4 w-4" />
          My Timesheet
        </button>

        {canApprove && (
          <button
            onClick={() => setViewMode('team')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'team'
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Users className="h-4 w-4" />
            Team Timesheets
          </button>
        )}

      </div>

      {/* =====================================================
          WEEK NAVIGATION
      ====================================================== */}

      <div className="bg-white border border-gray-200 rounded-lg p-4">

        <div className="flex items-center justify-between">

          <button
            onClick={() =>
              setCurrentWeek(
                subWeeks(currentWeek, 1)
              )
            }
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>

          <div className="text-center">

            <p className="font-medium text-gray-900">
              {format(currentWeek, 'd MMM')} –{' '}
              {format(
                weekEnd,
                'd MMM yyyy'
              )}
            </p>

            <button
              onClick={() =>
                setCurrentWeek(
                  startOfWeek(new Date(), {
                    weekStartsOn: 1,
                  })
                )
              }
              className="text-xs text-primary hover:underline mt-1"
            >
              Go to current week
            </button>

          </div>

          <button
            onClick={() =>
              setCurrentWeek(
                addWeeks(currentWeek, 1)
              )
            }
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Next week"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>

        </div>
      </div>

      {/* =====================================================
          MY TIMESHEET
      ====================================================== */}

      {viewMode === 'mine' && (
        <>
          {error ? (
            <div className="text-center py-12">

              <p className="text-red-600">
                Failed to load timesheet
              </p>

              <button
                onClick={() => refetch()}
                className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
              >
                Retry
              </button>

            </div>
          ) : (
            <>
              {/* SUMMARY CARDS */}

              {timesheet && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Logged
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheet.total_hours}h
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expected
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheet.expected_hours}h
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {Math.max(
                        0,
                        Number(
                          timesheet.expected_hours
                        ) -
                          Number(
                            timesheet.total_hours
                          )
                      )}
                      h
                    </p>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entries
                    </p>

                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {timesheet.entries?.length ||
                        0}
                    </p>
                  </div>

                </div>
              )}

              {/* WEEKLY GRID */}

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

                <div className="grid grid-cols-7 border-b border-gray-200">

                  {weekDays.map((day) => (
                    <div
                      key={day.toString()}
                      className="p-3 text-center"
                    >
                      <p className="text-xs font-medium text-gray-500 uppercase">
                        {format(day, 'EEE')}
                      </p>

                      <p
                        className={`text-lg font-semibold mt-0.5 ${
                          isSameDay(
                            day,
                            new Date()
                          )
                            ? 'text-primary'
                            : 'text-gray-900'
                        }`}
                      >
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

                <div className="divide-y divide-gray-100">

                  {weekDays.map((day) => {

                    const entries =
                      entriesByDay(day);

                    const isLocked =
                      timesheet?.status ===
                        'approved' ||
                      timesheet?.status ===
                        'locked';

                    return (
                      <div
                        key={day.toString()}
                        className="p-3 hover:bg-gray-50 transition-colors"
                      >

                        <div className="flex items-center justify-between">

                          <div className="flex-1">

                            {entries.length === 0 ? (
                              <p className="text-sm text-gray-400">
                                No entries
                              </p>
                            ) : (
                              <div className="space-y-2">

                                {entries.map(
                                  (entry) => (
                                    <div
                                      key={entry.id}
                                      className="flex items-center justify-between text-sm"
                                    >

                                      <div className="flex items-center gap-3">

                                        <span className="text-gray-500">
                                          {entry.start_time &&
                                          entry.end_time
                                            ? `${entry.start_time.slice(
                                                0,
                                                5
                                              )} - ${entry.end_time.slice(
                                                0,
                                                5
                                              )}`
                                            : `${entry.duration}h`}
                                        </span>

                                        <span className="text-gray-700">
                                          {entry.description ||
                                            'No description'}
                                        </span>

                                      </div>

                                      {!isLocked && (
                                        <div className="flex items-center gap-2">

                                          <button
                                            onClick={() => {
                                              setEditingEntry(
                                                entry
                                              );
                                              setShowEntryModal(
                                                true
                                              );
                                            }}
                                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                                            title="Edit"
                                          >
                                            <Edit2 className="h-3 w-3 text-gray-500" />
                                          </button>

                                          <button
                                            onClick={() =>
                                              handleDelete(
                                                entry.id
                                              )
                                            }
                                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                                            title="Delete"
                                          >
                                            <Trash2 className="h-3 w-3 text-gray-500" />
                                          </button>

                                        </div>
                                      )}

                                    </div>
                                  )
                                )}

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

              {/* ACTIONS */}

              <div className="flex items-center justify-between gap-4 flex-wrap">

                <button
                  onClick={() => {
                    setEditingEntry(null);
                    setShowEntryModal(true);
                  }}
                  disabled={
                    timesheet?.status ===
                      'approved' ||
                    timesheet?.status ===
                      'locked'
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Add Time
                </button>

                {timesheet &&
                  (timesheet.status ===
                    'draft' ||
                    timesheet.status ===
                      'rejected') && (
                    <button
                      onClick={
                        handleSubmitWeek
                      }
                      disabled={
                        submitMutation.isPending
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />

                      {submitMutation.isPending
                        ? 'Submitting...'
                        : 'Submit Timesheet'}
                    </button>
                  )}

              </div>
            </>
          )}
        </>
      )}

      {/* =====================================================
          TEAM TIMESHEETS
      ====================================================== */}

      {viewMode === 'team' && canApprove && (
        <div className="space-y-4">

          {/* TEAM HEADER */}

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Team Timesheets
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Review timesheets for employees within
                your permitted scope.
              </p>
            </div>

            <button
              onClick={() => refetchTeam()}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </button>

          </div>

          {/* TEAM ERROR */}

          {teamError && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-4">

              <p className="text-sm text-red-700">
                Failed to load team timesheets.
              </p>

              <button
                onClick={() => refetchTeam()}
                className="mt-2 text-sm font-medium text-red-700 hover:underline"
              >
                Try again
              </button>

            </div>
          )}

          {/* TEAM LOADING */}

          {teamLoading ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 flex justify-center">

              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />

            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

              {teamTimesheets.length === 0 ? (
                <div className="py-16 text-center">

                  <Users className="h-10 w-10 text-gray-300 mx-auto" />

                  <h3 className="mt-3 text-sm font-medium text-gray-900">
                    No team timesheets
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    There are no timesheets available
                    for this week.
                  </p>

                </div>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full">

                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">

                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>

                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Hours
                        </th>

                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>

                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>

                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>

                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">

                      {teamTimesheets.map(
                        (item) => {

                          const employeeName =
                            getPersonName(
                              item.person_id
                            );

                          const canTakeAction =
                            item.status ===
                              'submitted' ||
                            item.status ===
                              'under_review';

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-gray-50"
                            >

                              {/* EMPLOYEE */}

                              <td className="px-5 py-4">

                                <div className="flex items-center gap-3">

                                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">

                                    <span className="text-xs font-semibold text-primary">
                                      {employeeName
                                        .split(' ')
                                        .map(
                                          (part) =>
                                            part[0]
                                        )
                                        .join('')
                                        .slice(
                                          0,
                                          2
                                        )
                                        .toUpperCase()}
                                    </span>

                                  </div>

                                  <div>

                                    <p className="text-sm font-medium text-gray-900">
                                      {employeeName}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                      {item.entries
                                        ?.length ||
                                        0}{' '}
                                      entries
                                    </p>

                                  </div>

                                </div>

                              </td>

                              {/* HOURS */}

                              <td className="px-5 py-4">

                                <p className="text-sm font-semibold text-gray-900">
                                  {item.total_hours}h
                                </p>

                                <p className="text-xs text-gray-500">
                                  of{' '}
                                  {
                                    item.expected_hours
                                  }
                                  h
                                </p>

                              </td>

                              {/* STATUS */}

                              <td className="px-5 py-4">

                                <span
                                  className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusColor(
                                    item.status
                                  )}`}
                                >
                                  {formatStatus(
                                    item.status
                                  )}
                                </span>

                              </td>

                              {/* SUBMITTED */}

                              <td className="px-5 py-4">

                                {item.submitted_at ? (
                                  <div>

                                    <p className="text-sm text-gray-700">
                                      {format(
                                        new Date(
                                          item.submitted_at
                                        ),
                                        'd MMM yyyy'
                                      )}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                      {format(
                                        new Date(
                                          item.submitted_at
                                        ),
                                        'h:mm a'
                                      )}
                                    </p>

                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-400">
                                    Not submitted
                                  </span>
                                )}

                              </td>

                              {/* ACTIONS */}

                              <td className="px-5 py-4">

                                <div className="flex items-center justify-end gap-2">

                                  {/* HISTORY */}

                                  <button
                                    onClick={() => {
                                      setSelectedTimesheet(
                                        item
                                      );
                                      setShowHistoryModal(
                                        true
                                      );
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50"
                                    title="View approval history"
                                  >
                                    <History className="h-3.5 w-3.5" />
                                    History
                                  </button>

                                  {/* VIEW */}

                                  <button
                                    onClick={() =>
                                      setSelectedTimesheet(
                                        item
                                      )
                                    }
                                    className="p-1.5 rounded-lg hover:bg-gray-100"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4 text-gray-500" />
                                  </button>

                                  {/* APPROVE */}

                                  {canTakeAction && (
                                    <button
                                      onClick={() =>
                                        handleApprove(
                                          item
                                        )
                                      }
                                      disabled={
                                        approveMutation.isPending
                                      }
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />

                                      {approveMutation.isPending
                                        ? '...'
                                        : 'Approve'}
                                    </button>
                                  )}

                                  {/* RETURN */}

                                  {canTakeAction && (
                                    <button
                                      onClick={() => {
                                        setReturningTimesheetId(
                                          item.id
                                        );
                                        setReturnComment(
                                          ''
                                        );
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      Return
                                    </button>
                                  )}

                                </div>

                              </td>

                            </tr>
                          );
                        }
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </div>
          )}

          {/* TEAM SUMMARY */}

          {teamTimesheets.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <div className="bg-white border border-gray-200 rounded-lg p-4">

                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Team
                </p>

                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {teamTimesheets.length}
                </p>

              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">

                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Submitted
                </p>

                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {
                    teamTimesheets.filter(
                      (item) =>
                        item.status ===
                        'submitted'
                    ).length
                  }
                </p>

              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">

                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Approved
                </p>

                <p className="text-2xl font-bold text-green-600 mt-1">
                  {
                    teamTimesheets.filter(
                      (item) =>
                        item.status ===
                        'approved'
                    ).length
                  }
                </p>

              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4">

                <p className="text-xs uppercase tracking-wider text-gray-500">
                  Returned
                </p>

                <p className="text-2xl font-bold text-red-600 mt-1">
                  {
                    teamTimesheets.filter(
                      (item) =>
                        item.status ===
                        'rejected'
                    ).length
                  }
                </p>

              </div>

            </div>
          )}

        </div>
      )}

      {/* =====================================================
          ENTRY MODAL
      ====================================================== */}

      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-lg font-semibold text-gray-900">
                {editingEntry
                  ? 'Edit Time Entry'
                  : 'Add Time'}
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

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>

                <input
                  type="date"
                  name="date"
                  defaultValue={
                    editingEntry?.date ||
                    new Date()
                      .toISOString()
                      .split('T')[0]
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>

                  <input
                    type="time"
                    name="start_time"
                    defaultValue={
                      editingEntry?.start_time?.slice(
                        0,
                        5
                      ) || ''
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>

                  <input
                    type="time"
                    name="end_time"
                    defaultValue={
                      editingEntry?.end_time?.slice(
                        0,
                        5
                      ) || ''
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />

                </div>

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (hours) *
                </label>

                <input
                  type="number"
                  name="duration"
                  step="0.5"
                  min="0"
                  defaultValue={
                    editingEntry?.duration || ''
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Break (minutes)
                </label>

                <input
                  type="number"
                  name="break_minutes"
                  min="0"
                  defaultValue={
                    editingEntry?.break_minutes || 0
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />

              </div>

              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>

                <input
                  type="text"
                  name="description"
                  defaultValue={
                    editingEntry?.description || ''
                  }
                  placeholder="What did you work on?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />

              </div>

              <div className="flex items-center gap-3 pt-2">

                <button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ||
                  updateMutation.isPending
                    ? 'Saving...'
                    : editingEntry
                    ? 'Update'
                    : 'Save'}
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

      {/* =====================================================
          RETURN TIMESHEET MODAL
      ====================================================== */}

      {returningTimesheetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 z-[60]">

          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">

            <div className="flex items-start justify-between">

              <div>

                <h3 className="text-lg font-semibold text-gray-900">
                  Return Timesheet
                </h3>

                <p className="text-sm text-gray-500 mt-1">
                  Provide a reason so the employee knows
                  what needs to be corrected.
                </p>

              </div>

              <button
                onClick={() => {
                  setReturningTimesheetId(null);
                  setReturnComment('');
                }}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>

            </div>

            <div className="mt-5">

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for return *
              </label>

              <textarea
                value={returnComment}
                onChange={(e) =>
                  setReturnComment(e.target.value)
                }
                rows={5}
                placeholder="Example: Please correct the hours entered for Wednesday and resubmit."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

            </div>

            <div className="flex items-center justify-end gap-3 mt-5">

              <button
                onClick={() => {
                  setReturningTimesheetId(null);
                  setReturnComment('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                onClick={handleReturn}
                disabled={
                  !returnComment.trim() ||
                  returnMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />

                {returnMutation.isPending
                  ? 'Returning...'
                  : 'Return Timesheet'}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          APPROVAL HISTORY MODAL
      ====================================================== */}

      {showHistoryModal &&
        selectedTimesheet && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-xl">

              <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <History className="h-5 w-5 text-primary" />

                    <h3 className="text-lg font-semibold text-gray-900">
                      Approval History
                    </h3>

                  </div>

                  <p className="text-sm text-gray-500 mt-1">

                    {getPersonName(
                      selectedTimesheet.person_id
                    )}

                    {' · '}

                    {format(
                      new Date(
                        selectedTimesheet.week_start_date
                      ),
                      'd MMM'
                    )}

                    {' – '}

                    {format(
                      new Date(
                        selectedTimesheet.week_end_date
                      ),
                      'd MMM yyyy'
                    )}

                  </p>

                </div>

                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedTimesheet(null);
                  }}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>

              </div>

              <div className="p-6 overflow-y-auto max-h-[65vh]">

                {historyLoading ? (
                  <div className="flex justify-center py-10">

                    <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />

                  </div>
                ) : approvalHistory.length === 0 ? (
                  <div className="text-center py-10">

                    <History className="h-9 w-9 text-gray-300 mx-auto" />

                    <p className="mt-3 text-sm font-medium text-gray-900">
                      No history yet
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Approval activity will appear here.
                    </p>

                  </div>
                ) : (
                  <div className="space-y-5">

                    {(
                      approvalHistory as HistoryItem[]
                    ).map(
                      (history, index) => {

                        const isApproved =
                          history.action
                            ?.toLowerCase()
                            .includes(
                              'approv'
                            );

                        const isRejected =
                          history.action
                            ?.toLowerCase()
                            .includes(
                              'reject'
                            ) ||
                          history.action
                            ?.toLowerCase()
                            .includes(
                              'return'
                            );

                        return (
                          <div
                            key={
                              history.id ||
                              `${history.action}-${index}`
                            }
                            className="relative flex gap-4"
                          >

                            {/* TIMELINE */}

                            <div className="flex flex-col items-center">

                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                                  isApproved
                                    ? 'bg-green-50 text-green-600'
                                    : isRejected
                                    ? 'bg-red-50 text-red-600'
                                    : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {isApproved ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : isRejected ? (
                                  <XCircle className="h-4 w-4" />
                                ) : (
                                  <Clock className="h-4 w-4" />
                                )}
                              </div>

                              {index <
                                approvalHistory.length -
                                  1 && (
                                <div className="w-px bg-gray-200 flex-1 mt-2" />
                              )}

                            </div>

                            {/* CONTENT */}

                            <div className="flex-1 pb-4">

                              <div className="flex items-start justify-between gap-3">

                                <div>

                                  <p className="text-sm font-semibold text-gray-900">
                                    {getActionLabel(
                                      history.action
                                    )}
                                  </p>

                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {getHistoryPersonName(
                                      history.performed_by
                                    )}
                                  </p>

                                </div>

                                {history.created_at && (
                                  <span className="text-xs text-gray-400 whitespace-nowrap">
                                    {format(
                                      new Date(
                                        history.created_at
                                      ),
                                      'd MMM yyyy, h:mm a'
                                    )}
                                  </span>
                                )}

                              </div>

                              {history.comment && (
                                <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">

                                  <p className="text-sm text-gray-600">
                                    {history.comment}
                                  </p>

                                </div>
                              )}

                            </div>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex justify-end">

                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedTimesheet(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

    </div>
  );
}
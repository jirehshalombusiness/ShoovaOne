import { AlertCircle, Check, Clock, FileText, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '@/services/notification.service';
import { timesheetService, Timesheet } from '@/services/timesheet.service';
import { useAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, startOfWeek } from 'date-fns';

export function ActionRequired() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getNotifications,
  });
  const canApprove = user?.permissions.includes('timesheets.approve') ?? false;
  const { data: teamTimesheets = [] } = useQuery({
    queryKey: ['team-timesheets', 'dashboard'],
    queryFn: () => timesheetService.getTeamTimesheets(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')),
    enabled: canApprove,
  });
  const approve = useMutation({
    mutationFn: (timesheetId: string) => timesheetService.approveTimesheet(timesheetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-timesheets', 'dashboard'] }),
  });
  const returnForCorrection = useMutation({
    mutationFn: (timesheetId: string) => timesheetService.returnTimesheet(timesheetId, 'Please review and correct this timesheet.'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-timesheets', 'dashboard'] }),
  });
  const actions = notifications.filter((notification) => !notification.is_read).slice(0, 4).map((notification) => ({
    ...notification,
    context: notification.body,
    dueDate: formatDistanceToNow(new Date(notification.created_at), { addSuffix: true }),
    priority: notification.type === 'error' ? 'high' : notification.type === 'warning' ? 'medium' : 'low',
    icon: notification.type === 'warning' ? AlertCircle : FileText,
  }));
  const submittedTimesheets = teamTimesheets.filter((timesheet) => timesheet.status === 'submitted');

  const hasActions = actions.length > 0 || submittedTimesheets.length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Action Required</h3>
        {hasActions && (
          <button className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
            View all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3 py-5">
          <div className="h-4 w-48 bg-gray-200 rounded" />
          <div className="h-3 w-64 bg-gray-200 rounded" />
        </div>
      ) : !hasActions ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">You're all caught up</p>
          <p className="text-xs text-gray-400 mt-0.5">No actions require your attention</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submittedTimesheets.map((timesheet: Timesheet) => (
            <div key={timesheet.id} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
              <div className="p-1.5 bg-white rounded-md"><FileText className="h-4 w-4 text-yellow-700" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Timesheet awaiting approval</p>
                <p className="text-xs text-gray-500 mt-0.5">{timesheet.total_hours}h logged for {format(new Date(timesheet.week_start_date), 'd MMM')} – {format(new Date(timesheet.week_end_date), 'd MMM yyyy')}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => approve.mutate(timesheet.id)} disabled={approve.isPending} className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"><Check className="h-3 w-3" />Approve</button>
                  <button onClick={() => returnForCorrection.mutate(timesheet.id)} disabled={returnForCorrection.isPending} className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 disabled:opacity-50"><X className="h-3 w-3" />Return</button>
                </div>
              </div>
            </div>
          ))}
          {actions.map((action) => (
            <div
              key={action.id}
              onClick={() => action.link && navigate(action.link)}
              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <div className="p-1.5 bg-white rounded-md">
                <action.icon className="h-4 w-4 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{action.context}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {action.dueDate}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    action.priority === 'high' 
                      ? 'bg-red-100 text-red-700'
                      : action.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {action.priority}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
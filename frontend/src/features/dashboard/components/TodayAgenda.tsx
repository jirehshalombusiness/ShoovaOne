import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, isBefore, startOfDay } from 'date-fns';
import {
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  Video,
  CheckSquare,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { meetingsService } from '@/services/meetings.service';
import { myWorkService, type MyTask } from '@/services/mywork.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

const priorityStyles: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function TodayAgenda() {
  const navigate = useNavigate();
  const access = useHRAccess();
  const canOpenTasks = access.has('tasks.view');

  const meetingsQuery = useQuery({
    queryKey: ['meetings', 'today'],
    queryFn: () => meetingsService.list({ window: 'today', limit: 20 }),
    refetchInterval: 2 * 60_000,
  });

  const tasksQuery = useQuery({
    queryKey: ['my-work', 'tasks', 'today'],
    queryFn: () => myWorkService.getTasks('today'),
    refetchInterval: 60_000,
  });

  const meetings = meetingsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const isLoading = meetingsQuery.isLoading || tasksQuery.isLoading;

  const visibleTasks = tasks.slice(0, 4);
  const visibleMeetings = meetings.slice(0, 6);
  const total = tasks.length + meetings.length;

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">Today</h3>
          <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {format(new Date(), 'EEE, MMM d')}
          </span>
        </div>
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Calendar
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 h-full">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-700">
              Your day is clear
            </p>
            <p className="text-xs text-gray-500 mt-1">
              No meetings or tasks due today
            </p>
            <button
              onClick={() => navigate('/meetings/new')}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3 h-3" />
              Schedule a meeting
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={
                  canOpenTasks ? () => navigate(`/tasks/${task.id}`) : undefined
                }
              />
            ))}

            {visibleMeetings.map((meeting) => {
              const starts = new Date(meeting.starts_at);
              const ends = new Date(meeting.ends_at);
              const LocationIcon =
                meeting.location_type === 'video'
                  ? Video
                  : meeting.location_type === 'phone'
                    ? Phone
                    : MapPin;

              return (
                <button
                  key={meeting.id}
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
                >
                  <div className="w-14 flex-shrink-0 pt-0.5">
                    <div className="text-[12px] font-semibold text-gray-900 tabular-nums">
                      {format(starts, 'h:mm a')}
                    </div>
                    <div className="text-[10px] text-gray-400 tabular-nums">
                      {format(ends, 'h:mm a')}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-gray-900 truncate">
                        {meeting.title}
                      </span>
                      {meeting.my_response === 'pending' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-semibold uppercase tracking-wider flex-shrink-0">
                          RSVP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <LocationIcon className="w-2.5 h-2.5" />
                        {meeting.location_type === 'video'
                          ? 'Video'
                          : meeting.location_type === 'phone'
                            ? 'Phone'
                            : meeting.location || 'In person'}
                      </span>
                      <span>{meeting.attendee_count} people</span>
                    </div>
                  </div>

                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {total > visibleTasks.length + visibleMeetings.length && (
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50">
          <button
            onClick={() => navigate('/my-work')}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            +{total - visibleTasks.length - visibleMeetings.length} more today
          </button>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onClick,
}: {
  task: MyTask;
  onClick?: () => void;
}) {
  const overdue = task.due_date
    ? isBefore(startOfDay(new Date(task.due_date)), startOfDay(new Date()))
    : false;
  const priority = task.priority || 'medium';

  const content = (
    <>
      <span
        className={cn(
          'w-8 h-8 rounded-md border flex items-center justify-center flex-shrink-0',
          priorityStyles[priority] ?? priorityStyles.medium,
        )}
      >
        <CheckSquare className="w-3.5 h-3.5" strokeWidth={1.75} />
      </span>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {task.title}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
          <Clock className="w-2.5 h-2.5" />
          {overdue ? 'Overdue' : 'Due today'}
          <span className="capitalize text-gray-400">· {priority}</span>
        </div>
      </div>
    </>
  );

  if (!onClick) {
    return (
      <div className="w-full flex items-start gap-3 px-5 py-3">{content}</div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      {content}
      <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
    </button>
  );
}

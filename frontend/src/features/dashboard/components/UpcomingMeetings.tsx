import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  Phone,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { meetingsService } from '@/services/meetings.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function UpcomingMeetings() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', 'dashboard-widget'],
    queryFn: () => meetingsService.getUpcoming(3),
    refetchInterval: 2 * 60_000,
  });

  const meetings = data ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Your Next Meetings
          </h3>
        </div>
        <button
          onClick={() => navigate('/meetings')}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          All meetings
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
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 h-full">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-700">No upcoming meetings</p>
            <p className="text-xs text-gray-500 mt-1">Your calendar is clear</p>
            <button
              onClick={() => navigate('/meetings/new')}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3 h-3" />
              Schedule a Meeting
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {meetings.map((meeting) => {
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
                  <div className="w-11 text-center flex-shrink-0 border border-gray-200 rounded-md overflow-hidden">
                    <div className="bg-gray-50 text-[8px] font-bold text-gray-500 uppercase py-0.5">
                      {format(starts, 'MMM')}
                    </div>
                    <div className="text-base font-bold text-gray-900 py-0.5">
                      {format(starts, 'd')}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-gray-900 truncate">
                      {meeting.title}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {format(starts, 'h:mm a')} – {format(ends, 'h:mm a')}
                      </span>
                      <span className="flex items-center gap-1">
                        <LocationIcon className="w-2.5 h-2.5" />
                        {meeting.location_type === 'video'
                          ? 'Video'
                          : meeting.location_type === 'phone'
                            ? 'Phone'
                            : 'In person'}
                      </span>
                      <span>{meeting.attendee_count} people</span>
                    </div>
                  </div>

                  {meeting.meeting_url && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(meeting.meeting_url!, '_blank', 'noopener');
                      }}
                      className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded-md text-[10px] font-medium hover:bg-primary-dark transition-colors flex-shrink-0 mt-1"
                    >
                      <Video className="w-2.5 h-2.5" />
                      Join
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
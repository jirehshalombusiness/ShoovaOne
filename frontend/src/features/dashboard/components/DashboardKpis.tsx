import { useQuery } from '@tanstack/react-query';
import { peopleService } from '@/services/people';
import { attendanceService } from '@/services/attendance.service';
import { notificationService } from '@/services/notification.service';
import { timesheetService } from '@/services/timesheet.service';
import { Users, FolderKanban, CheckSquare, Clock, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { startOfWeek, format } from 'date-fns';

export function DashboardKpis() {
  const { data: people, isLoading: peopleLoading } = useQuery({
    queryKey: ['people'],
    queryFn: () => peopleService.getAll({ limit: 100 }),
  });
  const { data: todayAttendance } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: attendanceService.getToday,
  });
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationService.getUnreadCount,
  });
  const { data: timesheet } = useQuery({
    queryKey: ['timesheet', 'dashboard', format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')],
    queryFn: () => timesheetService.getMyTimesheet(
      format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    ),
  });

  // Calculate real stats
  const totalPeople = people?.length || 0;
  const staffCount = people?.filter(p => p.type === 'staff').length || 0;
  const volunteerCount = people?.filter(p => p.type === 'volunteer').length || 0;
  const beneficiaryCount = people?.filter(p => p.type === 'beneficiary').length || 0;

  const kpis = [
    {
      label: 'Active People',
      value: totalPeople,
      description: `${staffCount} Staff · ${volunteerCount} Volunteers · ${beneficiaryCount} Beneficiaries`,
      icon: Users,
    },
    {
      label: 'Active Projects',
      value: '—',
      description: 'Project tracking coming soon',
      icon: FolderKanban,
    },
    {
      label: 'Open Tasks',
      value: '—',
      description: 'Task tracking coming soon',
      icon: CheckSquare,
    },
    {
      label: "Today's Attendance",
      value: todayAttendance ? 'In' : 'Out',
      description: todayAttendance?.check_out ? 'Attendance complete today' : 'Today’s attendance status',
      icon: Clock,
    },
    {
      label: 'This Week Hours',
      value: timesheet?.total_hours ?? '—',
      description: timesheet
        ? `${timesheet.status} · ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
        : `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`,
      icon: Bell,
    },
  ];

  if (peopleLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-5">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {kpi.label}
            </span>
            <kpi.icon className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{kpi.value}</p>
          <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>
        </div>
      ))}
    </div>
  );
}
import { type ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  Users,
  UserCheck,
  FileText,
  ArrowRight,
  Calendar,
  Cake,
} from 'lucide-react';
import { format } from 'date-fns';

export function HRPage() {
  const navigate = useNavigate();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['hr', 'overview'],
    queryFn: () => hrService.getOverview(),
  });

  const { data: celebrations } = useQuery({
    queryKey: ['hr', 'celebrations'],
    queryFn: () => hrService.getCelebrations(60),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total People',
      value: overview?.total_people ?? 0,
      icon: Users,
      tone: 'primary',
    },
    {
      label: 'Active Staff',
      value: overview?.active_staff ?? 0,
      icon: UserCheck,
      tone: 'success',
    },
    {
      label: 'Volunteers',
      value: overview?.active_volunteers ?? 0,
      icon: Users,
      tone: 'info',
    },
    {
      label: 'Celebrations',
      value: celebrations?.length ?? 0,
      icon: Cake,
      tone: 'warning',
    },
  ];

  const upcomingCelebrations = celebrations ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-500">
          People, compliance, and organisational health
        </p>
        <button
          onClick={() => navigate('/people')}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Users className="w-4 h-4" />
          View People
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  {s.label}
                </span>
                <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-2">
                {s.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Quick Links */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Quick Access
          </h3>
          <div className="space-y-1">
            <QuickLink
              icon={Users}
              label="Employees"
              description="Browse all staff and their records"
              onClick={() => navigate('/hr/employees')}
            />
            <QuickLink
              icon={FileText}
              label="Documents"
              description="Compliance and required docs"
              onClick={() => navigate('/hr/documents')}
            />
            <QuickLink
              icon={Calendar}
              label="Celebrations"
              description="Birthdays and anniversaries"
              onClick={() => navigate('/hr/celebrations')}
            />
          </div>
        </div>

        {/* Celebrations */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Upcoming Celebrations
            </h3>
            <button
              onClick={() => navigate('/hr/celebrations')}
              className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-0.5"
            >
              View all
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {upcomingCelebrations.length === 0 ? (
            <div className="text-center py-8">
              <Cake
                className="w-8 h-8 text-gray-300 mx-auto mb-2"
                strokeWidth={1.5}
              />
              <p className="text-xs text-gray-500">
                No upcoming celebrations in the next 60 days
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingCelebrations.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Avatar
                    firstName={c.first_name}
                    lastName={c.last_name}
                    imageUrl={c.image_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Cake className="w-2.5 h-2.5" />
                      {c.type === 'birthday' ? `Turns ${c.years}` : 'Anniversary'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-gray-700">
                      {c.days_away === 0
                        ? 'Today'
                        : c.days_away === 1
                          ? 'Tomorrow'
                          : `In ${c.days_away}d`}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {format(new Date(c.date), 'MMM d')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: ElementType;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-600" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900">{label}</div>
        <div className="text-[11px] text-gray-500">{description}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService, Project } from '@/services/project.service';
import { Avatar } from '@/components/ui/Avatar';
import { Clock, TrendingUp, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export function ProjectTimesheets() {
  useOutletContext<{ project: Project }>();
  const { id: projectId } = useParams<{ id: string }>();

  type Person = {
    person_id: string;
    first_name: string;
    last_name: string;
    profile_image_url?: string;
    total_hours: number;
  };

  type RecentEntry = {
    id: string;
    person_first_name: string;
    person_last_name: string;
    person_image_url?: string;
    duration: number;
    description?: string;
    date?: string;
  };

  type TimesheetsResponse = {
    total_hours?: number;
    people?: Person[];
    recent_entries?: RecentEntry[];
  };

  const { data, isLoading } = useQuery<TimesheetsResponse>({
    queryKey: ['project-timesheets', projectId],
    queryFn: async () => {
      const getProjectTimesheets = (
        projectService as typeof projectService & {
          getProjectTimesheets?: (id: string) => Promise<TimesheetsResponse>;
        }
      ).getProjectTimesheets;

      return getProjectTimesheets
        ? getProjectTimesheets(projectId!)
        : { total_hours: 0, people: [], recent_entries: [] };
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalHours = data?.total_hours ?? 0;
  const people = data?.people ?? [];
  const recentEntries = data?.recent_entries ?? [];
  const maxHours = Math.max(...people.map((p) => p.total_hours), 1);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Timesheets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Hours logged to this project
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Total Hours
            </span>
            <Clock className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {totalHours.toFixed(1)}h
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {recentEntries.length} recent entries
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Contributors
            </span>
            <Users className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {people.length}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {people.length === 1 ? 'person has logged time' : 'people have logged time'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Avg per Person
            </span>
            <TrendingUp className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {people.length > 0 ? (totalHours / people.length).toFixed(1) : '0.0'}h
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            across the team
          </div>
        </div>
      </div>

      {/* Empty state */}
      {totalHours === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No hours logged yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Team members can log time against this project from the Timesheets module
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hours by person */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Hours by Person
            </h3>
            <div className="space-y-3">
              {people.map((person) => {
                const pct = (person.total_hours / maxHours) * 100;
                return (
                  <div key={person.person_id}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Avatar
                        firstName={person.first_name}
                        lastName={person.last_name}
                        imageUrl={person.profile_image_url}
                        size="xs"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-gray-900 truncate">
                          {person.first_name} {person.last_name}
                        </div>
                      </div>
                      <div className="text-[11px] font-semibold text-gray-700">
                        {person.total_hours.toFixed(1)}h
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent entries */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Recent Entries
            </h3>
            {recentEntries.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400">
                No entries yet
              </div>
            ) : (
              <div className="space-y-2">
                {recentEntries.slice(0, 8).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0"
                  >
                    <Avatar
                      firstName={entry.person_first_name}
                      lastName={entry.person_last_name}
                      imageUrl={entry.person_image_url}
                      size="xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-gray-900 truncate">
                          {entry.person_first_name} {entry.person_last_name}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                          {entry.duration.toFixed(1)}h
                        </span>
                      </div>
                      {entry.description && (
                        <div className="text-[10px] text-gray-500 truncate mt-0.5">
                          {entry.description}
                        </div>
                      )}
                      {entry.date && (
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(entry.date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarRange,
  GraduationCap,
  Layers,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import {
  programmesService,
  PROGRAMME_LEVEL_LABELS,
  type ProgrammeLevel,
  type ProgrammeStatus,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { ProgrammeStatusBadge } from '../components/ProgrammeBadges';
import { formatDateRange } from '../programmeUtils';

export function ProgrammesListPage() {
  const navigate = useNavigate();
  const access = useHRAccess();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProgrammeStatus | ''>('');
  const [levelFilter, setLevelFilter] = useState<ProgrammeLevel | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['programmes', 'list', search, statusFilter, levelFilter],
    queryFn: () =>
      programmesService.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        level: levelFilter || undefined,
        limit: 200,
      }),
    refetchInterval: 60_000,
  });

  const programmes = data ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Programmes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Academic catalogue, curriculum and cohorts
          </p>
        </div>

        {access.has('programmes.create') && (
          <button
            onClick={() => navigate('/programmes/new')}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Programme
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search programmes…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProgrammeStatus | '')}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          {(
            ['draft', 'active', 'completed', 'archived'] as ProgrammeStatus[]
          ).map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as ProgrammeLevel | '')}
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All levels</option>
          {(Object.keys(PROGRAMME_LEVEL_LABELS) as ProgrammeLevel[]).map(
            (level) => (
              <option key={level} value={level}>
                {PROGRAMME_LEVEL_LABELS[level]}
              </option>
            ),
          )}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : programmes.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <GraduationCap
              className="w-7 h-7 text-gray-300"
              strokeWidth={1.5}
            />
          </div>
          <p className="text-sm font-medium text-gray-700">
            {search || statusFilter || levelFilter
              ? 'No programmes match these filters'
              : 'No programmes yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {search || statusFilter || levelFilter
              ? 'Try widening your search.'
              : 'Create the first programme to start building a curriculum.'}
          </p>
          {access.has('programmes.create') &&
            !search &&
            !statusFilter &&
            !levelFilter && (
              <button
                onClick={() => navigate('/programmes/new')}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Programme
              </button>
            )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {programmes.map((programme) => (
            <button
              key={programme.id}
              onClick={() => navigate(`/programmes/${programme.id}`)}
              className="text-left bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ProgrammeStatusBadge status={programme.status} />
                    {programme.level && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
                        {PROGRAMME_LEVEL_LABELS[programme.level]}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-semibold text-gray-900 mt-2 truncate group-hover:text-primary transition-colors">
                    {programme.name}
                  </h3>
                  {programme.code && (
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                      {programme.code}
                    </p>
                  )}
                </div>

                {programme.lead && (
                  <Avatar
                    firstName={programme.lead.first_name}
                    lastName={programme.lead.last_name}
                    imageUrl={programme.lead.profile_image_url}
                    size="sm"
                  />
                )}
              </div>

              {programme.description && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                  {programme.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-4 text-[11px] text-gray-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {programme.course_count}{' '}
                  {programme.course_count === 1 ? 'course' : 'courses'}
                </span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {programme.cohort_count}{' '}
                  {programme.cohort_count === 1 ? 'cohort' : 'cohorts'}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {programme.learner_count}{' '}
                  {programme.learner_count === 1 ? 'learner' : 'learners'}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarRange className="w-3 h-3" />
                  {formatDateRange(
                    programme.start_date,
                    programme.end_date,
                  )}
                </span>
              </div>

              {(programme.organisation_name || programme.department_name) && (
                <div className="text-[11px] text-gray-400 mt-2 truncate">
                  {[programme.organisation_name, programme.department_name]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Route, Search, UserPlus, Users } from 'lucide-react';
import {
  programmesService,
  type EnrolmentStatus,
} from '@/services/programmes.service';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { EnrolmentStatusBadge } from '../components/ProgrammeBadges';
import { ProgrammeEnrolModal } from '../components/ProgrammeEnrolModal';
import { ProgrammePicker } from '../components/ProgrammePicker';
import { formatDate } from '../programmeUtils';

export function ProgrammeLearnersPage() {
  const navigate = useNavigate();
  const access = useHRAccess();
  const canManage = access.has('programmes.edit');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrolmentStatus | ''>('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [showEnrol, setShowEnrol] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [
      'programmes',
      'learners',
      'directory',
      search,
      statusFilter,
      programmeFilter,
    ],
    queryFn: () =>
      programmesService.listLearners({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        programme_id: programmeFilter || undefined,
        limit: 500,
      }),
    refetchInterval: 60_000,
  });

  const learners = data ?? [];
  const filtering = !!search || !!statusFilter || !!programmeFilter;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Learners
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Student records across every programme
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowEnrol(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Enrol learner
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email or programme…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as EnrolmentStatus | '')
          }
          className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="completed">Completed</option>
          <option value="withdrawn">Withdrawn</option>
        </select>

        <div className="min-w-[200px] max-w-xs flex-1">
          <ProgrammePicker
            value={programmeFilter}
            onChange={setProgrammeFilter}
            includeClosed
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_110px_150px_40px] gap-4 px-5 py-2.5 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <span>Learner</span>
          <span>Programme · Cohort</span>
          <span>Status</span>
          <span>Modules</span>
          <span />
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-9 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : learners.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {filtering ? 'No learners match these filters' : 'No learners yet'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {filtering
                ? 'Try widening your search.'
                : 'Enrol someone into a cohort to start their journey.'}
            </p>
            {canManage && !filtering && (
              <button
                onClick={() => setShowEnrol(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Enrol learner
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {learners.map((learner) => {
              const progress = learner.assignments_total
                ? Math.round(
                    (learner.assignments_completed /
                      learner.assignments_total) *
                      100,
                  )
                : 0;
              return (
                <button
                  key={learner.enrolment_id}
                  onClick={() =>
                    navigate(
                      `/programmes/enrolments/${learner.enrolment_id}/journey`,
                    )
                  }
                  className="w-full grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_110px_150px_40px] gap-2 md:gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors group items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      firstName={learner.person.first_name}
                      lastName={learner.person.last_name}
                      imageUrl={learner.person.profile_image_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-900 truncate">
                        {learner.person.first_name} {learner.person.last_name}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {learner.person.email ||
                          (learner.enrolled_on
                            ? `Enrolled ${formatDate(learner.enrolled_on)}`
                            : '—')}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 md:pl-0 pl-12">
                    <div className="text-[12px] text-gray-800 truncate">
                      {learner.programme_name}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {learner.cohort_name}
                    </div>
                  </div>

                  <div className="pl-12 md:pl-0">
                    <EnrolmentStatusBadge status={learner.status} />
                  </div>

                  <div className="pl-12 md:pl-0">
                    {learner.assignments_total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              progress >= 100 ? 'bg-emerald-500' : 'bg-primary',
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                          {learner.assignments_completed}/
                          {learner.assignments_total}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        No modules yet
                      </span>
                    )}
                  </div>

                  <div className="hidden md:flex justify-end">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400 group-hover:text-primary transition-colors">
                      <Route className="w-3.5 h-3.5" />
                      <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showEnrol && (
        <ProgrammeEnrolModal onClose={() => setShowEnrol(false)} />
      )}
    </div>
  );
}
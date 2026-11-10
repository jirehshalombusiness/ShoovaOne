import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Route, Search, UserPlus, Users } from 'lucide-react';
import {
  programmesService,
  type EnrolmentStatus,
} from '@/services/programmes.service';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { EnrolmentStatusBadge } from '../components/ProgrammeBadges';
import { ProgrammeEnrolModal } from '../components/ProgrammeEnrolModal';
import { useProgrammeWorkspace } from '../programmeWorkspace';
import { formatDate } from '../programmeUtils';

export function ProgrammeLearnersSection() {
  const navigate = useNavigate();
  const { programme, canManage } = useProgrammeWorkspace();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnrolmentStatus | ''>('');
  const [showEnrol, setShowEnrol] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: [
      'programmes',
      'learners',
      'directory',
      programme.id,
      search,
      statusFilter,
    ],
    queryFn: () =>
      programmesService.listLearners({
        programme_id: programme.id,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 500,
      }),
    refetchInterval: 60_000,
  });

  const learners = data ?? [];
  const closed =
    programme.status === 'completed' || programme.status === 'archived';
  const filtering = !!search || !!statusFilter;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Learners ({programme.learner_count})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Student records enrolled on this programme
            </p>
          </div>
          {canManage && !closed && (
            <button
              onClick={() => setShowEnrol(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Enrol learner
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search learners…"
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
        </div>

        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3].map((i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-9 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : learners.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">
              {filtering ? 'No learners match these filters' : 'No learners yet'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {filtering
                ? 'Try widening your search.'
                : 'Enrol someone into a cohort to start their journey.'}
            </p>
            {canManage && !closed && !filtering && (
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
                <div
                  key={learner.enrolment_id}
                  className="flex items-center gap-3 px-5 py-3.5 group"
                >
                  <Avatar
                    firstName={learner.person.first_name}
                    lastName={learner.person.last_name}
                    imageUrl={learner.person.profile_image_url}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-gray-900">
                        {learner.person.first_name} {learner.person.last_name}
                      </span>
                      <EnrolmentStatusBadge status={learner.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                      <span className="truncate">{learner.cohort_name}</span>
                      {learner.enrolled_on && (
                        <span>Enrolled {formatDate(learner.enrolled_on)}</span>
                      )}
                      {learner.assignments_total > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <span
                              className={cn(
                                'block h-full rounded-full',
                                progress >= 100 ? 'bg-emerald-500' : 'bg-primary',
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </span>
                          {learner.assignments_completed}/
                          {learner.assignments_total} modules
                        </span>
                      ) : (
                        <span className="text-gray-400">No modules yet</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      navigate(
                        `/programmes/enrolments/${learner.enrolment_id}/journey`,
                      )
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 flex-shrink-0"
                  >
                    <Route className="w-3.5 h-3.5" />
                    Journey
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showEnrol && (
        <ProgrammeEnrolModal
          initialProgrammeId={programme.id}
          onClose={() => setShowEnrol(false)}
        />
      )}
    </div>
  );
}
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarRange,
  GraduationCap,
  MapPin,
  Plus,
  Users,
  UsersRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DELIVERY_MODE_LABELS,
  programmesService,
  type ProgrammeDetail,
} from '@/services/programmes.service';
import { CohortStatusBadge } from './ProgrammeBadges';
import { CohortModal, type CohortFormValues } from './CohortModal';
import { formatDateRange } from '../programmeUtils';

export function ProgrammeCohortsTab({
  programme,
  canManage,
}: {
  programme: ProgrammeDetail;
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const closed = programme.status === 'completed' || programme.status === 'archived';

  const createMutation = useMutation({
    mutationFn: (values: CohortFormValues) =>
      programmesService.createCohort(programme.id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['programmes'] });
      setShowModal(false);
      toast.success('Cohort created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create cohort');
    },
  });

  const cohorts = programme.cohorts;

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Cohorts ({cohorts.length})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Each intake runs the curriculum with its own roster
          </p>
        </div>
        {canManage && !closed && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New cohort
          </button>
        )}
      </div>

      {cohorts.length === 0 ? (
        <div className="text-center py-12">
          <UsersRound className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No cohorts yet</p>
          <p className="text-xs text-gray-500 mt-1">
            Create an intake to start enrolling learners.
          </p>
          {canManage && !closed && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New cohort
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {cohorts.map((cohort) => {
            const fill = cohort.capacity
              ? Math.min(
                  100,
                  Math.round((cohort.enrolled_count / cohort.capacity) * 100),
                )
              : null;

            return (
              <button
                key={cohort.id}
                onClick={() => navigate(`/programmes/cohorts/${cohort.id}`)}
                className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-gray-900">
                      {cohort.name}
                    </span>
                    <CohortStatusBadge status={cohort.status} />
                    {cohort.code && (
                      <span className="text-[10px] font-mono text-gray-400">
                        {cohort.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <CalendarRange className="w-3 h-3" />
                      {formatDateRange(cohort.start_date, cohort.end_date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {cohort.enrolled_count}
                      {cohort.capacity ? ` / ${cohort.capacity}` : ''} learners
                    </span>
                    <span className="flex items-center gap-1">
                      <UsersRound className="w-3 h-3" />
                      {cohort.instructor_count}{' '}
                      {cohort.instructor_count === 1
                        ? 'instructor'
                        : 'instructors'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {cohort.location ||
                        DELIVERY_MODE_LABELS[cohort.delivery_mode]}
                    </span>
                  </div>

                  {fill !== null && (
                    <div className="mt-2 max-w-xs">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={
                            fill >= 100
                              ? 'h-full bg-amber-500'
                              : 'h-full bg-primary'
                          }
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <ArrowUpRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
              </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <CohortModal
          isSaving={createMutation.isPending}
          onClose={() => setShowModal(false)}
          onSave={(values) => createMutation.mutate(values)}
        />
      )}
    </div>
  );
}

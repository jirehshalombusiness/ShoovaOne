import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ClipboardList, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  APPLICATION_STATUS_LABELS,
  programmesService,
  type ApplicationStatus,
  type ProgrammeApplication,
} from '@/services/programmes.service';
import { cn } from '@/lib/utils';
import { ApplicationStatusBadge } from '../components/ProgrammeBadges';
import { useProgrammeWorkspace } from '../programmeWorkspace';

const STATUS_ORDER: ApplicationStatus[] = [
  'submitted',
  'in_review',
  'accepted',
  'declined',
];

const FILTERS: { label: string; value: ApplicationStatus | '' }[] = [
  { label: 'All', value: '' },
  ...STATUS_ORDER.map((status) => ({
    label: APPLICATION_STATUS_LABELS[status],
    value: status,
  })),
];

function formatSubmitted(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, 'd MMM yyyy');
}

export function ProgrammeApplicationsPage() {
  const { programme, canManage } = useProgrammeWorkspace();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ApplicationStatus | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryKey = ['programmes', 'applications', programme.id];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => programmesService.listApplications(programme.id),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: ApplicationStatus;
    }) =>
      programmesService.reviewApplication(
        programme.id,
        applicationId,
        status,
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<ProgrammeApplication[]>(queryKey, (current) =>
        current
          ? current.map((item) => (item.id === updated.id ? updated : item))
          : current,
      );
      toast.success(
        `Application ${updated.reference} marked ${APPLICATION_STATUS_LABELS[
          updated.status
        ].toLowerCase()}`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ?? 'Failed to update application',
      );
    },
  });

  const applications = data ?? [];
  const visible = filter
    ? applications.filter((item) => item.status === filter)
    : applications;
  const countFor = (status: ApplicationStatus | '') =>
    status
      ? applications.filter((item) => item.status === status).length
      : applications.length;

  const decide = (applicationId: string, status: ApplicationStatus) =>
    reviewMutation.mutate({ applicationId, status });

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          Applications ({applications.length})
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Submissions from the public program pages. Accepting records the
          decision; enrol accepted applicants from the cohort roster.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setFilter(option.value)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                filter === option.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              )}
            >
              {option.label}
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  filter === option.value ? 'text-gray-300' : 'text-gray-400',
                )}
              >
                {countFor(option.value)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-10 text-center text-xs text-gray-500">
          Loading applications…
        </div>
      ) : error ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-red-700">
            Could not load applications
          </p>
          <p className="text-xs text-red-600 mt-1">
            {(error as Error)?.message ?? 'Try again in a moment.'}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {filter ? 'No applications in this state' : 'No applications yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {filter
              ? 'Try another filter to see the rest of the inbox.'
              : 'Applications submitted from this programme’s public page will appear here.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {visible.map((application) => {
            const expanded = expandedId === application.id;
            const pendingRow =
              reviewMutation.isPending &&
              reviewMutation.variables?.applicationId === application.id;
            const canDecide =
              application.status === 'submitted' ||
              application.status === 'in_review';

            return (
              <div key={application.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-gray-900">
                        {application.applicant_name}
                      </span>
                      <ApplicationStatusBadge status={application.status} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <a
                        href={`mailto:${application.applicant_email}`}
                        className="inline-flex items-center gap-1 hover:text-gray-900"
                      >
                        <Mail className="w-3 h-3" />
                        {application.applicant_email}
                      </a>
                      {application.applicant_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {application.applicant_phone}
                        </span>
                      )}
                      <span>{application.cohort_name}</span>
                      <span className="font-mono text-[10px] text-gray-400">
                        {application.reference}
                      </span>
                      <span>{formatSubmitted(application.submitted_at)}</span>
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {application.status === 'submitted' && (
                        <button
                          type="button"
                          disabled={pendingRow}
                          onClick={() => decide(application.id, 'in_review')}
                          className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Start review
                        </button>
                      )}
                      {canDecide ? (
                        <>
                          <button
                            type="button"
                            disabled={pendingRow}
                            onClick={() => decide(application.id, 'accepted')}
                            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={pendingRow}
                            onClick={() => decide(application.id, 'declined')}
                            className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingRow}
                          onClick={() => decide(application.id, 'in_review')}
                          className="px-2.5 py-1.5 rounded-md text-[11px] font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p
                  className={cn(
                    'mt-2.5 text-xs leading-5 text-gray-600 whitespace-pre-line',
                    !expanded && 'line-clamp-2',
                  )}
                >
                  {application.motivation}
                </p>
                {application.motivation.length > 180 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expanded ? null : application.id)
                    }
                    className="mt-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    {expanded ? 'Show less' : 'Read full statement'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

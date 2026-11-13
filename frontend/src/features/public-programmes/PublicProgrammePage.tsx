import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
} from 'lucide-react';
import type { PublicProgrammeCohort } from '@/services/programmes.service';
import { programmesService } from '@/services/programmes.service';
import {
  formatDate,
  formatDateRange,
  formatDeadline,
  toProgram,
} from './display';

export function PublicProgrammePage() {
  const { programmeId = '' } = useParams();
  const [preferredCohortId, setPreferredCohortId] = useState<string | null>(
    null,
  );

  const { data: publicProgrammes, isLoading } = useQuery({
    queryKey: ['public-programmes'],
    queryFn: () => programmesService.listPublic(),
    staleTime: 30_000,
  });

  const program = useMemo(
    () =>
      (publicProgrammes ?? []).map(toProgram).find(
        (item) => item.id === programmeId,
      ),
    [publicProgrammes, programmeId],
  );

  const selectedCohort =
    program?.cohorts.find((cohort) => cohort.id === preferredCohortId) ??
    program?.cohorts[0];

  if (isLoading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-4xl rounded-2xl border border-[#e6ebe7] bg-white px-6 py-16 text-center text-sm text-[#738078]"
      >
        Loading programme…
      </div>
    );
  }

  if (!program) {
    return (
      <section className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">
          This programme is not accepting applications
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#738078]">
          It may have closed, or the enrolment window has not opened yet.
        </p>
        <Link
          to="/apply"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#176b4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#0f513a]"
        >
          Browse open programmes <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl">
      <Link
        to="/apply"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#63736a] hover:text-[#176b4d]"
      >
        <ArrowLeft size={16} /> All programs
      </Link>
      <div
        className={`rounded-[26px] bg-gradient-to-br ${program.color} p-6 sm:p-10`}
      >
        <span className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-[#53665b]">
          {program.category}
        </span>
        <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
          {program.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#53665b] sm:text-base">
          {program.description || 'Programme details coming soon.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold text-[#53665b]">
            <MapPin size={15} /> {selectedCohort?.location || program.location}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold text-[#53665b]">
            <Clock3 size={15} /> {program.duration}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold text-[#53665b]">
            <CalendarDays size={15} />{' '}
            {selectedCohort
              ? formatDateRange(
                  selectedCohort.start_date,
                  selectedCohort.end_date,
                )
              : 'Cohort dates to be confirmed'}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6">
            <h2 className="text-lg font-semibold">Learning outcomes</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#68766f]">
              {program.learning_outcomes ||
                'Learning outcomes have not been added yet.'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6">
            <h2 className="text-lg font-semibold">
              Eligibility and required documents
            </h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#68766f]">
              {program.eligibility_requirements ||
                'No additional eligibility requirements have been listed.'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6">
            <h2 className="text-lg font-semibold">
              Choose an available cohort
            </h2>
            <div className="mt-4 space-y-3">
              {program.cohorts.map((cohort) => (
                <CohortOption
                  key={cohort.id}
                  cohort={cohort}
                  selected={selectedCohort?.id === cohort.id}
                  onSelect={() => setPreferredCohortId(cohort.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-[#e6ebe7] bg-white p-5">
          <div className="text-xs font-semibold text-[#829087]">
            APPLICATION DEADLINE
          </div>
          <div className="mt-1 text-lg font-semibold">
            {formatDeadline(selectedCohort?.enrolment_closes_on ?? null)}
          </div>
          <div className="my-5 border-t border-[#edf0ee]" />
          <div className="flex items-start gap-3 text-sm text-[#68766f]">
            <CalendarDays size={17} className="mt-0.5 text-[#176b4d]" />
            <span>
              <span className="block font-semibold text-[#18392c]">
                Selected cohort
              </span>
              {selectedCohort?.name || 'Choose a cohort'}
            </span>
          </div>
          {selectedCohort ? (
            <Link
              to={`/apply/${program.id}/apply?cohort=${encodeURIComponent(
                selectedCohort.id,
              )}`}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0f513a]"
            >
              Apply to this cohort <ArrowRight size={16} />
            </Link>
          ) : null}
          <p className="mt-3 text-center text-xs text-[#829087]">
            You’ll need your name, email and a short statement.
          </p>
        </aside>
      </div>
    </section>
  );
}

function CohortOption({
  cohort,
  selected,
  onSelect,
}: {
  cohort: PublicProgrammeCohort;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
        selected
          ? 'border-[#176b4d] bg-[#f3f8f4]'
          : 'border-[#e6ebe7] bg-white hover:border-[#c5d6cb]'
      }`}
    >
      <input
        type="radio"
        name="programme-cohort"
        value={cohort.id}
        checked={selected}
        onChange={onSelect}
        className="mt-1 accent-[#176b4d]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#18392c]">
          {cohort.name}
        </span>
        <span className="mt-1 block text-xs text-[#68766f]">
          {formatDateRange(cohort.start_date, cohort.end_date)}
          {cohort.location ? ` · ${cohort.location}` : ''}
        </span>
        <span className="mt-1 block text-xs text-[#829087]">
          {cohort.enrolment_closes_on
            ? `Applications close ${formatDate(cohort.enrolment_closes_on)}`
            : 'No application closing date'}
        </span>
      </span>
    </label>
  );
}

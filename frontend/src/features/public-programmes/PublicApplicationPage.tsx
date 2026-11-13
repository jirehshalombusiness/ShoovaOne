import { useMemo, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, ArrowRight, FileText, ShieldCheck } from 'lucide-react';
import { programmesService } from '@/services/programmes.service';
import { addApplication } from './application-store';
import { formatDateRange, toProgram } from './display';

export function PublicApplicationPage() {
  const { programmeId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [cohortId, setCohortId] = useState(
    searchParams.get('cohort') ?? '',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [motivation, setMotivation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    program?.cohorts.find((cohort) => cohort.id === cohortId) ??
    program?.cohorts[0];

  const submitApplication = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!program || !selectedCohort) return;

    setError('');
    setSubmitting(true);
    try {
      const receipt = await programmesService.submitPublicApplication(
        program.id,
        {
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          cohort_id: selectedCohort.id,
          motivation: motivation.trim(),
        },
      );
      addApplication({
        reference: receipt.reference,
        programmeId: program.id,
        programmeName: receipt.programme_name,
        cohortName: receipt.cohort_name,
        submittedAt: receipt.submitted_at,
      });
      navigate(
        `/apply/success?ref=${encodeURIComponent(receipt.reference)}`,
        { replace: true },
      );
    } catch (caught: unknown) {
      if (isAxiosError<{ detail?: string }>(caught)) {
        setError(
          caught.response?.data?.detail ||
            'We could not submit your application. Please try again.',
        );
      } else {
        setError('We could not submit your application. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-2xl rounded-2xl border border-[#e6ebe7] bg-white px-6 py-16 text-center text-sm text-[#738078]"
      >
        Loading application…
      </div>
    );
  }

  if (!program) {
    return (
      <section className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.03em]">
          This programme is not accepting applications
        </h1>
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
    <section className="mx-auto max-w-2xl">
      <Link
        to={`/apply/${program.id}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#63736a] hover:text-[#176b4d]"
      >
        <ArrowLeft size={16} /> Back to program
      </Link>
      <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6 shadow-[0_12px_36px_rgba(24,57,44,0.05)] sm:p-9">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf5ef] text-[#176b4d]">
            <FileText size={21} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a17d2d]">
              Application
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
              {program.title}
            </h1>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-[#f4f8f5] px-4 py-3 text-sm text-[#617269]">
          No account is needed. Your application will be saved for Shoova’s
          review. Keep the reference shown after you submit.
        </div>

        <form onSubmit={submitApplication} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Cohort</span>
            <select
              required
              value={selectedCohort?.id ?? ''}
              onChange={(event) => setCohortId(event.target.value)}
              className="w-full rounded-xl border border-[#dfe6e1] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
            >
              {program.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name} ·{' '}
                  {formatDateRange(cohort.start_date, cohort.end_date)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Full name
            </span>
            <input
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-[#dfe6e1] px-4 py-3 text-sm outline-none transition placeholder:text-[#a0aaa4] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
              placeholder="Your full name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Email address
            </span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#dfe6e1] px-4 py-3 text-sm outline-none transition placeholder:text-[#a0aaa4] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Phone number{' '}
              <span className="font-normal text-[#829087]">(optional)</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-[#dfe6e1] px-4 py-3 text-sm outline-none transition placeholder:text-[#a0aaa4] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
              placeholder="Your phone number"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              What interests you about this program?
            </span>
            <textarea
              required
              minLength={20}
              maxLength={4000}
              rows={4}
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              className="w-full resize-y rounded-xl border border-[#dfe6e1] px-4 py-3 text-sm outline-none transition placeholder:text-[#a0aaa4] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
              placeholder="Tell us a little about what you hope to learn or contribute."
            />
            <span className="mt-1.5 block text-xs text-[#89958f]">
              20–4,000 characters
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#9a4338]"
            >
              {error}
            </p>
          )}
          <div className="flex items-start gap-2.5 rounded-xl border border-[#edf0ee] p-3.5 text-xs leading-5 text-[#738078]">
            <ShieldCheck
              size={17}
              className="mt-0.5 shrink-0 text-[#176b4d]"
            />
            Your contact details and statement are sent to Shoova for programme
            application review. Do not include sensitive personal information.
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0f513a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit application'}
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </section>
  );
}

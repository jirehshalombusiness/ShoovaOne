import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  programmesService,
  type PublicProgramme,
  type PublicProgrammeCohort,
} from '@/services/programmes.service';

type Program = PublicProgramme & {
  category: string;
  title: string;
  location: string;
  duration: string;
  color: string;
  icon: typeof BookOpen;
};

type ApplicationReceipt = {
  reference: string;
  programTitle: string;
  cohortName: string;
  submittedAt: string;
};

const programStyle = (category: string) => {
  const normalized = category.toLowerCase();
  if (normalized.includes('entrepreneur')) {
    return { color: 'from-[#fae8d8] to-[#fbf2df]', icon: Briefcase };
  }
  if (normalized.includes('leadership') || normalized.includes('community')) {
    return { color: 'from-[#dcefe5] to-[#f1f5df]', icon: Users };
  }
  return { color: 'from-[#e1e9fa] to-[#edf3fb]', icon: BookOpen };
};

const formatDate = (value: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date to be confirmed';

const formatDeadline = (value: string | null) =>
  value ? formatDate(value) : 'No closing date';

const formatDateRange = (
  startDate: string | null,
  endDate: string | null,
) => {
  if (!startDate && !endDate) return 'Dates to be confirmed';
  if (!endDate) return `Starts ${formatDate(startDate)}`;
  if (!startDate) return `Ends ${formatDate(endDate)}`;
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

const toProgram = (source: PublicProgramme): Program => {
  const category = source.department_name || 'Shoova programme';
  const style = programStyle(category);
  const firstCohort = source.cohorts[0];
  return {
    ...source,
    category,
    title: source.name,
    location:
      firstCohort?.location ||
      firstCohort?.delivery_mode.replace('_', ' ') ||
      'Location to be confirmed',
    duration: source.duration_weeks
      ? `${source.duration_weeks} weeks`
      : 'Duration to be confirmed',
    ...style,
  };
};

type Screen = 'explore' | 'detail' | 'apply' | 'success' | 'applications';

export function ProgramsPreviewPage({
  onStaffSignIn,
}: {
  onStaffSignIn?: () => void;
} = {}) {
  const [screen, setScreen] = useState<Screen>('explore');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All programs');
  const [applications, setApplications] = useState<ApplicationReceipt[]>([]);
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [motivation, setMotivation] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationLoading, setApplicationLoading] = useState(false);

  const {
    data: publicProgrammes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['public-programmes'],
    queryFn: () => programmesService.listPublic(),
    staleTime: 30_000,
  });
  const programs = useMemo(
    () => (publicProgrammes ?? []).map(toProgram),
    [publicProgrammes],
  );
  const selectedProgram = programs.find(
    (program) => program.id === selectedProgramId,
  );
  const selectedCohort = selectedProgram?.cohorts.find(
    (cohort) => cohort.id === selectedCohortId,
  );

  const categories = [
    'All programs',
    ...Array.from(new Set(programs.map((program) => program.category))),
  ];

  const filteredPrograms = useMemo(() => {
    const query = search.trim().toLowerCase();
    return programs.filter((program) => {
      const matchesCategory =
        category === 'All programs' || program.category === category;
      const matchesSearch =
        !query ||
        `${program.title} ${program.description ?? ''} ${program.location} ${program.category}`
          .toLowerCase()
          .includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [category, programs, search]);

  const openProgram = (program: Program) => {
    setSelectedProgramId(program.id);
    setSelectedCohortId(program.cohorts[0]?.id ?? '');
    setApplicationError('');
    setApplicantName('');
    setApplicantEmail('');
    setApplicantPhone('');
    setMotivation('');
    setScreen('detail');
  };

  const submitApplication = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!selectedProgram || !selectedCohort) return;

    setApplicationError('');
    setApplicationLoading(true);
    try {
      const receipt = await programmesService.submitPublicApplication(
        selectedProgram.id,
        {
          full_name: applicantName.trim(),
          email: applicantEmail.trim(),
          phone: applicantPhone.trim() || null,
          cohort_id: selectedCohort.id,
          motivation: motivation.trim(),
        },
      );
      setApplications((current) => [
        {
          reference: receipt.reference,
          programTitle: receipt.programme_name,
          cohortName: receipt.cohort_name,
          submittedAt: new Date(receipt.submitted_at).toLocaleDateString(
            'en-GH',
            { day: 'numeric', month: 'long', year: 'numeric' },
          ),
        },
        ...current,
      ]);
      setApplicationId(receipt.reference);
      setScreen('success');
    } catch (error: unknown) {
      if (isAxiosError<{ detail?: string }>(error)) {
        setApplicationError(
          error.response?.data?.detail ||
            'We could not submit your application. Please try again.',
        );
      } else {
        setApplicationError(
          'We could not submit your application. Please try again.',
        );
      }
    } finally {
      setApplicationLoading(false);
    }
  };

  const goToExplore = () => setScreen('explore');

  return (
    <div className="programs-preview-page min-h-screen bg-[#f7f8f6] pb-24 text-[#18392c]">
      <header className="sticky top-0 z-20 border-b border-[#e7ece8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={goToExplore}
            aria-label="Shoova Programs home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#176b4d] text-lg font-bold text-white">
              S
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-tight">
                Shoova
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.17em] text-[#7b8982]">
                Programs
              </span>
            </span>
          </button>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            <button
              type="button"
              onClick={goToExplore}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                screen !== 'applications'
                  ? 'bg-[#eaf5ef] text-[#176b4d]'
                  : 'text-[#68766f] hover:bg-[#f3f6f4]'
              }`}
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => setScreen('applications')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                screen === 'applications'
                  ? 'bg-[#eaf5ef] text-[#176b4d]'
                  : 'text-[#68766f] hover:bg-[#f3f6f4]'
              }`}
            >
              Recent submissions
              {applications.length > 0 && (
                <span className="ml-2 rounded-full bg-[#176b4d] px-1.5 py-0.5 text-[10px] text-white">
                  {applications.length}
                </span>
              )}
            </button>
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            {onStaffSignIn && (
              <button
                type="button"
                onClick={onStaffSignIn}
                className="rounded-full px-3 py-2 text-xs font-semibold text-[#176b4d] transition hover:bg-[#f2f7f3]"
              >
                Staff sign in
              </button>
            )}
            <div className="flex items-center gap-2 rounded-full border border-[#e6ece8] px-3 py-1.5 text-xs font-semibold text-[#66746d]">
              <span className="h-2 w-2 rounded-full bg-[#d49e36]" />
              Local demo
            </div>
          </div>
          <div className="flex items-center gap-1 sm:hidden">
            <button
              type="button"
              onClick={() => setScreen('applications')}
              className="rounded-full bg-[#eaf5ef] px-3 py-2 text-xs font-semibold text-[#176b4d]"
            >
              Recent
              {applications.length > 0 && ` (${applications.length})`}
            </button>
            {onStaffSignIn && (
              <button
                type="button"
                onClick={onStaffSignIn}
                className="rounded-full px-3 py-2 text-xs font-semibold text-[#176b4d]"
              >
                Staff
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-7 sm:px-8 sm:pt-10">
        {screen === 'explore' && (
          <>
            <section className="relative isolate overflow-hidden rounded-[28px] bg-[#123f30] px-6 py-8 text-white shadow-[0_18px_48px_rgba(18,63,48,0.12)] sm:px-10 sm:py-11 lg:px-14">
              <div className="absolute -right-20 -top-32 -z-10 h-80 w-80 rounded-full border-[40px] border-white/[0.04]" />
              <div className="absolute -bottom-36 right-[18%] -z-10 h-72 w-72 rounded-full bg-[#c79a35]/10 blur-2xl" />
              <div className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
                <div className="max-w-xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-[#dcece4]">
                    <Sparkles size={14} className="text-[#e7c876]" />
                    Discover what you can become
                  </div>
                  <h1 className="max-w-lg text-3xl font-semibold leading-[1.13] tracking-[-0.04em] sm:text-5xl">
                    Your next chapter starts here.
                  </h1>
                  <p className="mt-4 max-w-md text-sm leading-6 text-[#c5d9cf] sm:text-base">
                    Find practical programs, meet people who believe in your
                    potential, and take your next step with confidence.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById('program-list')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e8c66f] px-5 py-3 text-sm font-bold text-[#18392c] transition hover:bg-[#f0d384]"
                  >
                    Explore programs <ArrowRight size={16} />
                  </button>
                </div>

                <div className="relative mx-auto hidden h-52 w-full max-w-[330px] md:block">
                  <div className="absolute left-5 top-6 h-40 w-40 rounded-[30px] bg-[#d9ead9] p-5 text-[#176b4d] shadow-xl shadow-black/10 -rotate-6">
                    <div className="flex h-full flex-col justify-between rounded-[20px] border border-[#176b4d]/10 p-4">
                      <Users size={27} strokeWidth={1.6} />
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.16em]">
                          Grow together
                        </div>
                        <div className="mt-1 text-lg font-semibold leading-tight">
                          Make an impact
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-1 right-2 rounded-2xl border border-white/50 bg-white p-4 text-[#18392c] shadow-xl shadow-black/10">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5ecd4] text-[#a97d20]">
                        <BookOpen size={19} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Made for you</div>
                        <div className="mt-0.5 text-[11px] text-[#76837c]">
                          Learn · Connect · Grow
                        </div>
                      </div>
                      <div className="ml-2 flex -space-x-2">
                        {['#d98d67', '#849e76', '#8e9dc5'].map((color) => (
                          <span
                            key={color}
                            className="h-7 w-7 rounded-full border-2 border-white"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute right-8 top-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8c66f] text-[#18392c] shadow-lg shadow-black/10 rotate-6">
                    <Sparkles size={22} />
                  </div>
                </div>
              </div>
            </section>

            <section id="program-list" className="scroll-mt-24 py-10 sm:py-12">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
                    Find your opportunity
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                    Programs open for applications
                  </h2>
                  <p className="mt-2 text-sm text-[#738078]">
                    Take a look around. Your next step could be closer than you
                    think.
                  </p>
                </div>
                <div className="relative w-full sm:max-w-xs">
                  <Search
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89958f]"
                  />
                  <input
                    aria-label="Search programs"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search programs"
                    className="w-full rounded-xl border border-[#e2e8e4] bg-white py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-[#9aa59f] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      category === item
                        ? 'bg-[#176b4d] text-white'
                        : 'border border-[#e2e8e4] bg-white text-[#66746d] hover:border-[#b8c9bf]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div
                  role="status"
                  className="mt-5 rounded-2xl border border-[#e6ebe7] bg-white px-6 py-12 text-center text-sm text-[#738078]"
                >
                  Loading open programmes…
                </div>
              ) : isError ? (
                <div className="mt-5 rounded-2xl border border-[#f0d7d2] bg-white px-6 py-12 text-center">
                  <p className="font-semibold text-[#8c4135]">
                    Programmes could not be loaded
                  </p>
                  <p className="mt-1 text-sm text-[#738078]">
                    Check your connection and try again.
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="mt-4 rounded-xl bg-[#176b4d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f513a]"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredPrograms.length > 0 ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPrograms.map((program) => {
                    const Icon = program.icon;
                    return (
                      <article
                        key={program.id}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-[#e6ebe7] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#c5d6cb] hover:shadow-[0_16px_34px_rgba(24,57,44,0.08)]"
                      >
                        <div
                          className={`relative flex h-36 items-end overflow-hidden bg-gradient-to-br ${program.color} p-5`}
                        >
                          <div className="absolute -right-5 -top-10 h-40 w-40 rounded-full border-[22px] border-white/35" />
                          <div className="absolute right-12 top-7 h-14 w-14 rounded-2xl bg-white/45 rotate-12" />
                          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/75 text-[#176b4d] shadow-sm">
                            <Icon size={23} strokeWidth={1.7} />
                          </div>
                          <span className="absolute right-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[10px] font-bold text-[#52655a]">
                            Applications open
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a17d2d]">
                            {program.category}
                          </div>
                          <h3 className="mt-2 text-lg font-semibold leading-snug tracking-[-0.02em]">
                            {program.title}
                          </h3>
                          <p className="mt-2 flex-1 text-sm leading-6 text-[#738078]">
                            {program.description}
                          </p>
                          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#edf0ee] pt-4 text-xs text-[#68766f]">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin size={14} /> {program.location}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 size={14} /> {program.duration}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openProgram(program)}
                            className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-[#f2f7f3] px-4 py-3 text-sm font-semibold text-[#176b4d] transition group-hover:bg-[#eaf5ef]"
                          >
                            View program <ArrowRight size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-[#d6dfd9] bg-white px-6 py-12 text-center">
                  <Search size={22} className="mx-auto text-[#8b9b91]" />
                  <p className="mt-3 font-semibold">
                    {programs.length > 0
                      ? 'No programmes found'
                      : 'No programmes are accepting applications right now'}
                  </p>
                  <p className="mt-1 text-sm text-[#738078]">
                    {programs.length > 0
                      ? 'Try another search or choose a different category.'
                      : 'Please check back later for new cohorts.'}
                  </p>
                </div>
              )}
            </section>
          </>
        )}

        {screen === 'detail' && selectedProgram && (
          <section className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={goToExplore}
              className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#63736a] hover:text-[#176b4d]"
            >
              <ArrowLeft size={16} /> All programs
            </button>
            <div className={`rounded-[26px] bg-gradient-to-br ${selectedProgram.color} p-6 sm:p-10`}>
              <span className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-[#53665b]">
                {selectedProgram.category}
              </span>
              <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                {selectedProgram.title}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#53665b] sm:text-base">
                {selectedProgram.description || 'Programme details coming soon.'}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold text-[#53665b]">
                  <MapPin size={15} /> {selectedCohort?.location || selectedProgram.location}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 text-xs font-semibold text-[#53665b]">
                  <Clock3 size={15} /> {selectedProgram.duration}
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
                    {selectedProgram.learning_outcomes ||
                      'Learning outcomes have not been added yet.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6">
                  <h2 className="text-lg font-semibold">
                    Eligibility and required documents
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#68766f]">
                    {selectedProgram.eligibility_requirements ||
                      'No additional eligibility requirements have been listed.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e6ebe7] bg-white p-6">
                  <h2 className="text-lg font-semibold">
                    Choose an available cohort
                  </h2>
                  <div className="mt-4 space-y-3">
                    {selectedProgram.cohorts.map((cohort) => (
                      <CohortOption
                        key={cohort.id}
                        cohort={cohort}
                        selected={selectedCohortId === cohort.id}
                        onSelect={() => setSelectedCohortId(cohort.id)}
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
                <button
                  type="button"
                  onClick={() => setScreen('apply')}
                  disabled={!selectedCohort}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0f513a]"
                >
                  Apply to this cohort <ArrowRight size={16} />
                </button>
                <p className="mt-3 text-center text-xs text-[#829087]">
                  You’ll need your name, email and a short statement.
                </p>
              </aside>
            </div>
          </section>
        )}

        {screen === 'apply' && selectedProgram && (
          <section className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => setScreen('detail')}
              className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#63736a] hover:text-[#176b4d]"
            >
              <ArrowLeft size={16} /> Back to program
            </button>
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
                    {selectedProgram.title}
                  </h1>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-[#f4f8f5] px-4 py-3 text-sm text-[#617269]">
                No account is needed. Your application will be saved for
                Shoova’s review. Keep the reference shown after you submit.
              </div>

              <form onSubmit={submitApplication} className="mt-7 space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">
                    Cohort
                  </span>
                  <select
                    required
                    value={selectedCohortId}
                    onChange={(event) =>
                      setSelectedCohortId(event.target.value)
                    }
                    className="w-full rounded-xl border border-[#dfe6e1] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
                  >
                    {selectedProgram.cohorts.map((cohort) => (
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
                    value={applicantName}
                    onChange={(event) => setApplicantName(event.target.value)}
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
                    value={applicantEmail}
                    onChange={(event) => setApplicantEmail(event.target.value)}
                    className="w-full rounded-xl border border-[#dfe6e1] px-4 py-3 text-sm outline-none transition placeholder:text-[#a0aaa4] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">
                    Phone number <span className="font-normal text-[#829087]">(optional)</span>
                  </span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    value={applicantPhone}
                    onChange={(event) => setApplicantPhone(event.target.value)}
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
                {applicationError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#9a4338]"
                  >
                    {applicationError}
                  </p>
                )}
                <div className="flex items-start gap-2.5 rounded-xl border border-[#edf0ee] p-3.5 text-xs leading-5 text-[#738078]">
                  <ShieldCheck
                    size={17}
                    className="mt-0.5 shrink-0 text-[#176b4d]"
                  />
                  Your contact details and statement are sent to Shoova for
                  programme application review. Do not include sensitive
                  personal information.
                </div>
                <button
                  type="submit"
                  disabled={applicationLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0f513a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {applicationLoading ? 'Submitting…' : 'Submit application'}
                  {!applicationLoading && <ArrowRight size={16} />}
                </button>
              </form>
            </div>
          </section>
        )}

        {screen === 'success' && selectedProgram && (
          <section className="mx-auto max-w-xl py-10 text-center sm:py-16">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e5f4eb] text-[#176b4d]">
              <Check size={30} strokeWidth={2.2} />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
              Application received
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
              You’ve taken the first step, {applicantName.split(' ')[0]}.
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#738078]">
              Your application for {selectedProgram.title} was received for{' '}
              {selectedCohort?.name}. Save your reference number. Application
              status tracking is not available yet.
            </p>
            <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-[#e6ebe7] bg-white p-5 text-left">
              <div className="text-xs text-[#829087]">REFERENCE NUMBER</div>
              <div className="mt-1 font-mono text-lg font-semibold">
                {applicationId}
              </div>
              <div className="mt-4 border-t border-[#edf0ee] pt-4 text-sm">
                <div className="font-semibold">{selectedProgram.title}</div>
                <div className="mt-1 text-xs text-[#829087]">
                  Status: Application submitted
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setScreen('applications')}
                className="rounded-xl bg-[#176b4d] px-5 py-3 text-sm font-bold text-white hover:bg-[#0f513a]"
              >
                View recent submissions
              </button>
              <button
                type="button"
                onClick={goToExplore}
                className="rounded-xl border border-[#dfe6e1] bg-white px-5 py-3 text-sm font-semibold text-[#52645a] hover:bg-[#f6f8f6]"
              >
                Explore more programs
              </button>
            </div>
          </section>
        )}

        {screen === 'applications' && (
          <section className="mx-auto max-w-4xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
                  Your journey
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  Recent submissions
                </h1>
                <p className="mt-2 text-sm text-[#738078]">
                  Applications submitted during this visit.
                </p>
              </div>
              <button
                type="button"
                onClick={goToExplore}
                className="inline-flex items-center gap-2 self-start rounded-xl bg-[#176b4d] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f513a] sm:self-auto"
              >
                Explore programs <ArrowRight size={16} />
              </button>
            </div>

            {applications.length > 0 ? (
              <div className="mt-7 space-y-3">
                {applications.map((application) => (
                  <article
                    key={application.reference}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-[#e6ebe7] bg-white p-5 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ef] text-[#176b4d]">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h2 className="font-semibold">
                          {application.programTitle}
                        </h2>
                        <p className="mt-1 text-xs text-[#68766f]">
                          {application.cohortName}
                        </p>
                        <p className="mt-1 text-xs text-[#829087]">
                          Ref. {application.reference} · Submitted{' '}
                          {application.submittedAt}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#eaf5ef] px-3 py-1.5 text-xs font-semibold text-[#176b4d]">
                      Submitted
                    </span>
                  </article>
                ))}
                <p className="pt-2 text-xs text-[#89958f]">
                  This list is kept in the current browser session. Keep each
                  reference number to contact Shoova about an application.
                </p>
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-[#d6dfd9] bg-white px-6 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf5ef] text-[#176b4d]">
                  <FileText size={22} />
                </div>
                <h2 className="mt-4 text-lg font-semibold">
                  Your recent submissions will appear here
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#738078]">
                  After applying, save the reference number shown on the
                  confirmation screen.
                </p>
                <button
                  type="button"
                  onClick={goToExplore}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#176b4d] hover:text-[#0f513a]"
                >
                  Browse open programs <ChevronRight size={17} />
                </button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mx-auto mt-6 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-[#e6ebe7] px-5 py-6 text-xs text-[#829087] sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} Shoova Initiative</span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} /> A place to learn, connect, and grow
        </span>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eadfbd] bg-[#fff9e9] px-4 py-2.5 text-center text-xs font-medium text-[#77612c] safe-bottom">
        Local demo · Programmes load from the local database; applications are
        saved to the local database
      </div>
    </div>
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

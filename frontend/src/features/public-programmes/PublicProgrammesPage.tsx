import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  Clock3,
  MapPin,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { programmesService } from '@/services/programmes.service';
import { toProgram } from './display';

export function PublicProgrammesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All programs');

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

  return (
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
            <Link
              to="/apply#program-list"
              onClick={() =>
                document
                  .getElementById('program-list')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#e8c66f] px-5 py-3 text-sm font-bold text-[#18392c] transition hover:bg-[#f0d384]"
            >
              Explore programs <ArrowRight size={16} />
            </Link>
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
                    <Link
                      to={`/apply/${program.id}`}
                      className="mt-5 inline-flex w-full items-center justify-between rounded-xl bg-[#f2f7f3] px-4 py-3 text-sm font-semibold text-[#176b4d] transition group-hover:bg-[#eaf5ef]"
                    >
                      View program <ArrowRight size={16} />
                    </Link>
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
  );
}

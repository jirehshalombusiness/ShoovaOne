import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { useHRAccess } from '@/hooks/useHRAccess';
import { Avatar } from '@/components/ui/Avatar';
import type { Person } from '@/types/person.types';
import { peopleService } from '@/services/people.service';
import type {
  PeopleDirectoryCategory,
  PeopleDirectoryPerson,
} from '@/services/people.service';

interface PeopleDirectoryProps {
  onSelectPerson?: (person: Person) => void;
}

const PAGE_SIZE = 25;

const categories: {
  id: PeopleDirectoryCategory;
  label: string;
}[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'staff', label: 'Staff' },
  { id: 'partners', label: 'Partners' },
  { id: 'volunteers', label: 'Volunteers' },
  { id: 'students', label: 'Students' },
  { id: 'other', label: 'Other' },
];

const personTypeLabels: Record<string, string> = {
  staff: 'Staff',
  volunteer: 'Volunteer',
  beneficiary: 'Beneficiary',
  external_contact: 'Partner contact',
};

function statusClass(status: string) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'inactive') return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-600';
}

export function PeopleDirectory({ onSelectPerson }: PeopleDirectoryProps) {
  const navigate = useNavigate();
  const access = useHRAccess();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PeopleDirectoryCategory>('all');
  const [status, setStatus] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const normalizedCountryCode = countryCode.trim().toUpperCase();

  const query = useQuery({
    queryKey: [
      'people',
      'directory',
      category,
      debouncedSearch,
      status,
      normalizedCountryCode,
      offset,
    ],
    queryFn: () =>
      peopleService.getDirectory({
        category,
        offset,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        status: status ? (status as 'active' | 'inactive' | 'archived') : undefined,
        country_code: normalizedCountryCode || undefined,
      }),
  });

  const people = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const counts = query.data?.counts;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(status || normalizedCountryCode);

  const handleRowClick = (person: PeopleDirectoryPerson) => {
    if (onSelectPerson) {
      onSelectPerson(person);
    } else {
      navigate(`/people/${person.id}`);
    }
  };

  const clearFilters = () => {
    setStatus('');
    setCountryCode('');
    setOffset(0);
  };

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto border-b border-gray-200">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="People categories">
          {categories.map((item) => {
            const selected = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setCategory(item.id);
                  setOffset(0);
                }}
                className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {item.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    selected ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {counts?.[item.id] ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search name, email, phone, organisation, job title…"
            aria-label="Search people"
            className="w-full rounded-lg border border-gray-200 py-2.5 pl-9 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setOffset(0);
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((visible) => !visible)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            filtersActive
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter className="h-4 w-4" />
          Filters
          {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>
        {access.has('people.create') && (
          <button
            type="button"
            onClick={() => navigate('/people/new')}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <Plus className="h-4 w-4" />
            Add Person
          </button>
        )}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-medium text-gray-700">Record status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setOffset(0);
              }}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="min-w-[140px]">
            <span className="mb-1 block text-xs font-medium text-gray-700">Country code</span>
            <input
              value={countryCode}
              maxLength={2}
              onChange={(event) => {
                setCountryCode(event.target.value.replace(/[^a-z]/gi, '').slice(0, 2));
                setOffset(0);
              }}
              placeholder="e.g. GH"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm uppercase focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {query.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Unable to load people right now. Check your access and try again.</span>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="font-semibold underline disabled:opacity-50"
          >
            {query.isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      <section
        aria-label={`${categories.find((item) => item.id === category)?.label ?? 'People'} directory`}
        aria-busy={query.isFetching}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        {query.isLoading ? (
          <div className="divide-y divide-gray-100" aria-label="Loading people">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-64 max-w-full animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : people.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <User className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-800">
              {debouncedSearch || filtersActive ? 'No people match these filters' : 'No people in this category yet'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {debouncedSearch || filtersActive
                ? 'Try another search or clear the filters.'
                : 'People will appear here when they are added to the directory.'}
            </p>
            {(debouncedSearch || filtersActive) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  clearFilters();
                }}
                className="mt-3 text-sm font-semibold text-primary hover:underline"
              >
                Clear search and filters
              </button>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {people.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(person)}
                    className="group flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-4">
                      <Avatar
                        firstName={person.first_name}
                        lastName={person.last_name}
                        imageUrl={person.profile_image_url}
                        size="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-gray-900">
                            {person.preferred_name || person.first_name} {person.last_name}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(person.status)}`}>
                            {person.status || 'Unknown'}
                          </span>
                          {person.is_student && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              Student
                            </span>
                          )}
                          {!person.is_student && person.type === 'beneficiary' && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Beneficiary
                            </span>
                          )}
                          {person.type !== 'beneficiary' && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {personTypeLabels[person.type] ?? person.type.replaceAll('_', ' ')}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          {person.email && (
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{person.email}</span>
                            </span>
                          )}
                          {person.phone && (
                            <span className="inline-flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {person.phone}
                            </span>
                          )}
                          {(person.job_title || person.department) && (
                            <span className="truncate">
                              {[person.job_title, person.department].filter(Boolean).join(' · ')}
                            </span>
                          )}
                          {person.organization && (
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              {person.organization}
                            </span>
                          )}
                          {person.country && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {person.country}
                            </span>
                          )}
                          {!person.email && !person.phone && !person.organization && !person.job_title && (
                            <span className="text-xs text-gray-400">No contact details</span>
                          )}
                        </span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-700" />
                  </button>
                </li>
              ))}
            </ul>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">
                Showing {offset + 1}–{Math.min(offset + people.length, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
                  disabled={offset === 0 || query.isFetching}
                  aria-label="Previous page"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>
                <span className="min-w-16 text-center text-xs tabular-nums text-gray-600">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setOffset((current) => current + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total || query.isFetching}
                  aria-label="Next page"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

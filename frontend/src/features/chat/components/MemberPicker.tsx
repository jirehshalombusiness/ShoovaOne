import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { ChatUser } from '@/services/chat.service';
import { getFullName } from '../lib/chatFormat';

interface MemberPickerProps {
  people: ChatUser[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  excludeIds?: string[];
  loading?: boolean;
  emptyLabel?: string;
}

export function MemberPicker({
  people,
  selectedIds,
  onChange,
  multiple = true,
  excludeIds = [],
  loading = false,
  emptyLabel = 'No colleagues to show.',
}: MemberPickerProps) {
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => new Set(selectedIds),
    [selectedIds],
  );
  const excluded = useMemo(
    () => new Set(excludeIds),
    [excludeIds],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return people
      .filter((person) => !excluded.has(person.id))
      .filter((person) => {
        if (!needle) return true;
        const haystack = [
          getFullName(person),
          person.job_title ?? '',
          person.department ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
  }, [people, excluded, search]);

  const selectedPeople = useMemo(
    () => people.filter((person) => selected.has(person.id)),
    [people, selected],
  );

  const toggle = (personId: string) => {
    if (!multiple) {
      onChange([personId]);
      return;
    }

    onChange(
      selected.has(personId)
        ? selectedIds.filter((id) => id !== personId)
        : [...selectedIds, personId],
    );
  };

  const remove = (personId: string) => {
    onChange(selectedIds.filter((id) => id !== personId));
  };

  return (
    <div>
      {multiple && selectedPeople.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedPeople.map((person) => (
            <span
              key={person.id}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 py-0.5 pl-1 pr-1.5 text-[11px] font-medium text-emerald-700"
            >
              <Avatar
                firstName={person.first_name}
                lastName={person.last_name}
                imageUrl={person.profile_image_url}
                size="xs"
              />
              {getFullName(person)}
              <button
                type="button"
                onClick={() => remove(person.id)}
                aria-label={`Remove ${getFullName(person)}`}
                className="rounded-full p-0.5 text-emerald-600 transition-colors hover:bg-emerald-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search people"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-200">
        {loading ? (
          <div className="space-y-1 p-2">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex animate-pulse items-center gap-2 rounded-md p-2"
              >
                <div className="h-7 w-7 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-28 rounded bg-gray-100" />
                  <div className="h-2 w-20 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-500">
            {emptyLabel}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((person) => {
              const isSelected = selected.has(person.id);

              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-emerald-50/70'
                        : 'hover:bg-gray-50',
                    )}
                  >
                    <Avatar
                      firstName={person.first_name}
                      lastName={person.last_name}
                      imageUrl={person.profile_image_url}
                      size="sm"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-gray-900">
                        {getFullName(person)}
                      </span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {person.job_title || person.department || 'Team member'}
                      </span>
                    </span>

                    <span
                      className={cn(
                        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 text-transparent',
                      )}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

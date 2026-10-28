import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { peopleService } from '@/services/people.service';
import { useDebounce } from '@/hooks/useDebounce';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function PersonSearchList({
  excludeIds,
  selectedIds,
  onToggle,
  multiple = true,
  emptyLabel = 'No people to show',
}: {
  excludeIds: string[];
  selectedIds: string[];
  onToggle: (personId: string) => void;
  multiple?: boolean;
  emptyLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { data: people, isLoading } = useQuery({
    queryKey: ['people', 'programme-roster', debouncedSearch],
    queryFn: () =>
      peopleService.getAll({
        search: debouncedSearch || undefined,
        limit: 200,
      }),
  });

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const candidates = useMemo(
    () => (people ?? []).filter((person) => !excluded.has(person.id)),
    [people, excluded],
  );

  return (
    <div className="flex flex-col min-h-0">
      <div className="p-3 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 min-h-[200px] max-h-[380px]">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-gray-500">
            Loading people…
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">
            {emptyLabel}
          </div>
        ) : (
          candidates.slice(0, 100).map((person) => {
            const selected = selectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                onClick={() => onToggle(person.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  selected ? 'bg-primary/5' : 'hover:bg-gray-50',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center flex-shrink-0 border-2',
                    multiple ? 'w-4 h-4 rounded' : 'w-4 h-4 rounded-full',
                    selected ? 'bg-primary border-primary' : 'border-gray-300',
                  )}
                >
                  {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
                <Avatar
                  firstName={person.first_name}
                  lastName={person.last_name}
                  imageUrl={person.profile_image_url}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 truncate">
                    {person.first_name} {person.last_name}
                  </div>
                  {person.email && (
                    <div className="text-[11px] text-gray-500 truncate">
                      {person.email}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

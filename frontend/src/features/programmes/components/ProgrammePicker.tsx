import { useQuery } from '@tanstack/react-query';
import { programmesService } from '@/services/programmes.service';
import { cn } from '@/lib/utils';

export function ProgrammePicker({
  value,
  onChange,
  className,
  includeClosed = false,
}: {
  value: string;
  onChange: (programmeId: string) => void;
  className?: string;
  includeClosed?: boolean;
}) {
  const { data: programmes, isLoading } = useQuery({
    queryKey: ['programmes', 'list', 'picker'],
    queryFn: () => programmesService.list({ limit: 500 }),
  });

  const options = (programmes ?? []).filter(
    (programme) =>
      includeClosed ||
      (programme.status !== 'completed' && programme.status !== 'archived'),
  );

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={isLoading}
      className={cn(
        'w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50',
        className,
      )}
    >
      <option value="">
        {isLoading ? 'Loading programmes…' : 'Select a programme'}
      </option>
      {options.map((programme) => (
        <option key={programme.id} value={programme.id}>
          {programme.name}
          {programme.code ? ` (${programme.code})` : ''}
        </option>
      ))}
    </select>
  );
}
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Download,
  Search,
} from 'lucide-react';
import {
  courseworkService,
  GRADING_STATUS_LABELS,
  type GradebookCell,
  type GradebookRow,
} from '@/services/coursework.service';
import { Avatar } from '@/components/ui/Avatar';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';
import { useProgrammeWorkspace } from '../programmeWorkspace';

type SortKey = 'name' | 'percentage' | 'graded';
type GradebookCellView = GradebookCell & {
  grading_status?: GradebookCell['status'];
};
type GradebookRowView = GradebookRow & {
  enrolment_status?: string;
  total_score?: number;
  total_possible?: number;
  assignments_graded?: number;
  assignments_total?: number;
};

const STATUS_DOT: Record<GradebookCell['status'] | 'missing', string> = {
  graded: 'bg-emerald-500',
  submitted: 'bg-blue-500',
  changes_requested: 'bg-amber-500',
  missing: 'bg-gray-200',
};

export function ProgrammeGradebookPage() {
  const navigate = useNavigate();
  const { programme, canManage } = useProgrammeWorkspace();
  const access = useHRAccess();
  const canAssess = access.has('programmes.assess');
  const base = `/programmes/${programme.id}`;

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [onlyGraded, setOnlyGraded] = useState(false);

  const query = useQuery({
    queryKey: ['coursework', 'gradebook', programme.id],
    queryFn: () => courseworkService.getGradebook(programme.id),
    refetchInterval: 60_000,
  });

  const columns = query.data?.columns ?? [];
  const rows = (query.data?.rows ?? []) as GradebookRowView[];
  const totalPossible = query.data?.total_points_possible ?? 0;

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = rows.filter((row) => {
      const hay = `${row.person.first_name} ${row.person.last_name} ${row.person.email ?? ''}`.toLowerCase();
      return hay.includes(term);
    });
    if (onlyGraded) list = list.filter((r) => (r.assignments_graded ?? 0) > 0);

    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') {
        const an = `${a.person.first_name} ${a.person.last_name}`.toLowerCase();
        const bn = `${b.person.first_name} ${b.person.last_name}`.toLowerCase();
        return an.localeCompare(bn) * dir;
      }
      if (sortKey === 'percentage') {
        return ((a.percentage ?? -1) - (b.percentage ?? -1)) * dir;
      }
      return ((a.assignments_graded ?? 0) - (b.assignments_graded ?? 0)) * dir;
    });
    return list;
  }, [rows, search, sortKey, sortDir, onlyGraded]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const exportCsv = () => {
    const header = [
      'Learner',
      'Email',
      'Status',
      ...columns.map((c) => `${c.title} (/${c.points_possible})`),
      `Total (/${totalPossible})`,
      '%',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const row of filteredRows) {
      const cellsById = new Map(row.cells.map((c) => [c.assignment_id, c]));
      const line = [
        `${row.person.first_name} ${row.person.last_name}`,
        row.person.email ?? '',
        row.enrolment_status ?? '',
        ...columns.map((col) => {
          const cell = cellsById.get(col.assignment_id);
          return cell?.score != null ? String(cell.score) : '';
        }),
        `${row.total_score}`,
        row.percentage != null ? row.percentage.toFixed(1) : '',
      ];
      lines.push(line.map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${programme.name.replace(/\s+/g, '-').toLowerCase()}-gradebook.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const back = (
    <Link
      to={base}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {programme.name}
    </Link>
  );

  return (
    <div className="space-y-5">
      {back}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gradebook</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} learner{rows.length === 1 ? '' : 's'} · {columns.length} assignment
            {columns.length === 1 ? '' : 's'} · {totalPossible} points possible
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0 || columns.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <Link
            to={`${base}/assessments`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-dark"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Manage assignments
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            aria-label="Search learners"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learners…"
            className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={onlyGraded}
            onChange={(e) => setOnlyGraded(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Only learners with grades
        </label>
        <div className="ml-auto flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Graded
          <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Submitted
          <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Changes
          <span className="ml-3 inline-block h-2.5 w-2.5 rounded-full bg-gray-200" /> Missing
        </div>
      </div>

      {/* States */}
      {query.isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500" role="status">
          Loading gradebook…
        </div>
      ) : query.isError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-white p-6 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Could not load the gradebook.</p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                className="mt-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {query.isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          </div>
        </div>
      ) : columns.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No assignments yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Create and publish an assignment to start populating the gradebook.
          </p>
          {canManage && (
            <Link
              to={`${base}/assessments`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-white hover:bg-primary-dark"
            >
              Go to assessments
            </Link>
          )}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-sm font-medium text-gray-700">No learners match these filters</p>
          <p className="mt-1 text-xs text-gray-500">Try widening your search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Gradebook for {programme.name}</caption>
            <thead>
              <tr className="bg-gray-50 text-[11px] font-medium text-gray-500">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[220px] border-b border-gray-100 bg-gray-50 px-5 py-3 text-left"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Learner
                    <ArrowUpDown className={cn('h-3 w-3', sortKey === 'name' ? 'text-gray-900' : 'text-gray-300')} />
                  </button>
                </th>
                {columns.map((col) => (
                  <th
                    key={col.assignment_id}
                    scope="col"
                    className="min-w-[130px] border-b border-gray-100 px-3 py-3 text-left align-bottom"
                    title={`${col.course_title} · ${col.cohort_name}`}
                  >
                    <Link
                      to={`${base}/assessments/${col.assignment_id}`}
                      className="block truncate text-gray-700 hover:text-primary"
                    >
                      <div className="truncate font-medium">{col.title}</div>
                      <div className="mt-0.5 truncate text-[10px] font-normal text-gray-400">
                        {col.points_possible} pts
                        {col.status === 'draft' && ' · Draft'}
                      </div>
                    </Link>
                  </th>
                ))}
                <th scope="col" className="min-w-[90px] border-b border-l border-gray-100 px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('percentage')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Total
                    <ArrowUpDown className={cn('h-3 w-3', sortKey === 'percentage' ? 'text-gray-900' : 'text-gray-300')} />
                  </button>
                </th>
                <th scope="col" className="min-w-[90px] border-b border-gray-100 px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort('graded')}
                    className="inline-flex items-center gap-1 hover:text-gray-900"
                  >
                    Graded
                    <ArrowUpDown className={cn('h-3 w-3', sortKey === 'graded' ? 'text-gray-900' : 'text-gray-300')} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <GradebookTr
                  key={row.enrolment_id}
                  row={row}
                  columns={columns}
                  programmeBase={base}
                  canAssess={canAssess}
                  onOpenJourney={() =>
                    navigate(`/programmes/enrolments/${row.enrolment_id}/journey`)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GradebookTr({
  row,
  columns,
  programmeBase,
  canAssess,
  onOpenJourney,
}: {
  row: GradebookRowView;
  columns: { assignment_id: string; points_possible: number }[];
  programmeBase: string;
  canAssess: boolean;
  onOpenJourney: () => void;
}) {
  const cellsById = new Map(row.cells.map((c) => [c.assignment_id, c]));
  return (
    <tr className="align-top hover:bg-gray-50">
      <th scope="row" className="sticky left-0 z-10 border-b border-gray-100 bg-white px-5 py-3 text-left font-normal">
        <button
          type="button"
          onClick={onOpenJourney}
          className="flex items-center gap-2.5 text-left"
        >
          <Avatar
            firstName={row.person.first_name}
            lastName={row.person.last_name}
            imageUrl={row.person.profile_image_url}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900">
              {row.person.first_name} {row.person.last_name}
            </div>
            <div className="truncate text-[11px] text-gray-500">
              {row.person.email ?? row.enrolment_status}
            </div>
          </div>
        </button>
      </th>

      {columns.map((col) => {
        const cell = cellsById.get(col.assignment_id);
        const score = cell?.score ?? null;
        const status = cell?.status ?? 'missing';
        const href = `${programmeBase}/assessments/${col.assignment_id}`;
        return (
          <td key={col.assignment_id} className="border-b border-gray-100 px-3 py-3">
            <Link
              to={href}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100"
              title={
                cell?.submission_id
                  ? `${GRADING_STATUS_LABELS[status]}${cell.is_late ? ' · Late' : ''}`
                  : 'Not submitted'
              }
            >
              <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', STATUS_DOT[status])} />
              <span className="text-[13px] tabular-nums text-gray-900">
                {score != null ? score : '—'}
                <span className="text-gray-400"> / {col.points_possible}</span>
              </span>
            </Link>
          </td>
        );
      })}

      <td className="border-b border-l border-gray-100 px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-gray-900">
        {row.total_possible != null && row.total_possible > 0 ? (
          <>
            {row.total_score}
            <span className="text-gray-400"> / {row.total_possible}</span>
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      <td className="border-b border-gray-100 px-3 py-3 text-right text-[12px] tabular-nums text-gray-600">
        {row.percentage != null ? (
          <span
            className={cn(
              'font-medium',
              row.percentage >= 70
                ? 'text-emerald-700'
                : row.percentage >= 50
                  ? 'text-amber-700'
                  : 'text-red-700',
            )}
          >
            {row.percentage.toFixed(0)}%
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
        <div className="text-[10px] text-gray-400">
          {row.assignments_graded}/{row.assignments_total}
        </div>
      </td>
    </tr>
  );
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void CheckCircle2;
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  User,
  FolderKanban,
  CheckSquare,
  CalendarPlus,
  Clock,
  FolderPlus,
  UserPlus,
  UserCircle2,
  Loader2,
} from 'lucide-react';
import { NAV_SECTIONS } from '@/app/nav.config';
import { useHRAccess } from '@/hooks/useHRAccess';
import { peopleService } from '@/services/people.service';
import { projectService } from '@/services/project.service';
import { taskService } from '@/services/task.service';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandResult {
  key: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  iconClass?: string;
  path: string;
}

interface CommandGroup {
  label: string;
  items: CommandResult[];
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const access = useHRAccess();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebounced('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(query.trim());
      setActiveIndex(0);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searching = debounced.length >= 2;

  const peopleQuery = useQuery({
    queryKey: ['command', 'people', debounced],
    queryFn: () => peopleService.getAll({ search: debounced, limit: 5 }),
    enabled: open && searching && access.has('people.view'),
    staleTime: 30_000,
  });

  const projectsQuery = useQuery({
    queryKey: ['command', 'projects', debounced],
    queryFn: () => projectService.getAll({ search: debounced }),
    enabled: open && searching && access.has('projects.view'),
    staleTime: 30_000,
  });

  const tasksQuery = useQuery({
    queryKey: ['command', 'tasks', debounced],
    queryFn: () => taskService.getAll({ search: debounced }),
    enabled: open && searching && access.has('tasks.view'),
    staleTime: 30_000,
  });

  const groups = useMemo<CommandGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    const matches = (label: string, hint?: string) =>
      !needle ||
      label.toLowerCase().includes(needle) ||
      (hint?.toLowerCase().includes(needle) ?? false);

    const navItems: CommandResult[] = NAV_SECTIONS.flatMap((section) =>
      section.items
        .filter((item) => !item.permission || access.has(item.permission))
        .filter((item) => matches(item.label, item.path))
        .map((item) => ({
          key: `nav-${item.path}`,
          label: item.label,
          hint: section.label,
          icon: item.icon,
          path: item.path,
        })),
    );

    const actionItems: CommandResult[] = [
      {
        key: 'action-meeting',
        label: 'Schedule a meeting',
        hint: 'Calendar',
        icon: CalendarPlus,
        path: '/meetings/new',
      },
      ...(access.has('events.create')
        ? [
            {
              key: 'action-event',
              label: 'Create an event',
              hint: 'Events',
              icon: CalendarPlus,
              path: '/events/new',
            },
          ]
        : []),
      ...(access.has('timesheets.view')
        ? [
            {
              key: 'action-time',
              label: 'Log time',
              hint: 'Timesheets',
              icon: Clock,
              path: '/timesheets',
            },
          ]
        : []),
      ...(access.has('projects.create')
        ? [
            {
              key: 'action-project',
              label: 'Create a project',
              hint: 'Projects',
              icon: FolderPlus,
              path: '/projects/new',
            },
          ]
        : []),
      ...(access.has('people.create')
        ? [
            {
              key: 'action-person',
              label: 'Add a person',
              hint: 'Directory',
              icon: UserPlus,
              path: '/people/new',
            },
          ]
        : []),
      {
        key: 'action-profile',
        label: 'My profile',
        hint: 'Self service',
        icon: UserCircle2,
        path: '/me/profile',
      },
    ].filter((item) => matches(item.label, item.hint));

    const peopleItems: CommandResult[] = (peopleQuery.data ?? [])
      .slice(0, 5)
      .map((person) => ({
        key: `person-${person.id}`,
        label: `${person.first_name} ${person.last_name}`.trim(),
        hint: person.job_title || person.email || 'Person',
        icon: User,
        iconClass: 'bg-blue-50 text-blue-600',
        path: `/people/${person.id}`,
      }));

    const projectItems: CommandResult[] = (projectsQuery.data ?? [])
      .slice(0, 5)
      .map((project) => ({
        key: `project-${project.id}`,
        label: project.name,
        hint: project.code
          ? `${project.code} · ${project.status.replace(/_/g, ' ')}`
          : project.status.replace(/_/g, ' '),
        icon: FolderKanban,
        iconClass: 'bg-violet-50 text-violet-600',
        path: `/projects/${project.id}`,
      }));

    const taskItems: CommandResult[] = (tasksQuery.data ?? [])
      .slice(0, 5)
      .map((task) => ({
        key: `task-${task.id}`,
        label: task.title,
        hint: task.project_name || task.status.replace(/_/g, ' '),
        icon: CheckSquare,
        iconClass: 'bg-emerald-50 text-emerald-600',
        path: `/tasks/${task.id}`,
      }));

    return [
      { label: 'Navigate', items: navItems },
      { label: 'Quick actions', items: actionItems },
      { label: 'People', items: peopleItems },
      { label: 'Projects', items: projectItems },
      { label: 'Tasks', items: taskItems },
    ].filter((group) => group.items.length > 0);
  }, [
    query,
    access,
    peopleQuery.data,
    projectsQuery.data,
    tasksQuery.data,
  ]);

  const flatResults = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  const flatRef = useRef(flatResults);
  flatRef.current = flatResults;

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(0, flatResults.length - 1)),
    );
  }, [flatResults.length]);

  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`cmdk-item-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const run = (result: CommandResult) => {
    onClose();
    navigate(result.path);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatRef.current.length === 0) return;
      setActiveIndex((current) => (current + 1) % flatRef.current.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatRef.current.length === 0) return;
      setActiveIndex(
        (current) =>
          (current - 1 + flatRef.current.length) % flatRef.current.length,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const result = flatRef.current[activeIndex];
      if (result) run(result);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const isLoading =
    searching &&
    (peopleQuery.isFetching ||
      projectsQuery.isFetching ||
      tasksQuery.isFetching);

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-gray-900/40 backdrop-blur-[2px] px-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden animate-fade-in"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, projects, tasks or jump to a page..."
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-[10px] font-mono text-gray-500">
              esc
            </kbd>
          )}
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">
                No results for “{query.trim()}”
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Try a person's name, a project or a task
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </div>

                {group.items.map((item) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const active = index === activeIndex;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.key}
                      id={`cmdk-item-${index}`}
                      onClick={() => run(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        active ? 'bg-gray-50' : 'hover:bg-gray-50',
                      )}
                    >
                      <span
                        className={cn(
                          'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                          item.iconClass ?? 'bg-gray-100 text-gray-500',
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </span>

                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] font-medium text-gray-900 truncate">
                          {item.label}
                        </span>
                        {item.hint && (
                          <span className="block text-[11px] text-gray-500 truncate">
                            {item.hint}
                          </span>
                        )}
                      </span>

                      {active && (
                        <CornerDownLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
              navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" />
              open
            </span>
          </div>
          <span className="text-[10px] text-gray-400">
            Shoova ONE search
          </span>
        </div>
      </div>
    </div>
  );
}

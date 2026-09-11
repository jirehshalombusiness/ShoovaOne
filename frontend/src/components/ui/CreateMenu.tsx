import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ChevronDown,
  UserPlus,
  FolderPlus,
  CheckSquare,
  Building2,
  CalendarPlus,
  FileUp,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface CreateAction {
  icon: React.ElementType;
  label: string;
  description: string;
  permission?: string;
  onClick: () => void;
}

export function CreateMenu() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const actions: CreateAction[] = [
    {
      icon: UserPlus,
      label: 'Add Person',
      description: 'New person in the directory',
      permission: 'people.create',
      onClick: () => navigate('/people/new'),
    },
    {
      icon: CheckSquare,
      label: 'Create Task',
      description: 'Assign work to your team',
      permission: 'tasks.create',
      onClick: () => navigate('/tasks/new'),
    },
    {
      icon: FolderPlus,
      label: 'Create Project',
      description: 'Start a new project',
      permission: 'projects.create',
      onClick: () => navigate('/projects/new'),
    },
    {
      icon: Clock,
      label: 'Log Time',
      description: 'Add a timesheet entry',
      permission: 'timesheets.submit',
      onClick: () => navigate('/timesheets'),
    },
    {
      icon: Building2,
      label: 'Add Organisation',
      description: 'Partner, donor or contact',
      permission: 'crm.create',
      onClick: () => navigate('/organisations/new'),
    },
    {
      icon: CalendarPlus,
      label: 'Create Event',
      description: 'Schedule a new event',
      permission: 'events.create',
      onClick: () => navigate('/events/new'),
    },
    {
      icon: FileUp,
      label: 'Upload Document',
      description: 'Add a file to the library',
      permission: 'documents.upload',
      onClick: () => navigate('/documents/upload'),
    },
  ];

  // Filter to actions the user can perform
  const visibleActions = actions.filter(
    (a) => !a.permission || hasPermission(a.permission)
  );

  if (visibleActions.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
          open
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-700 hover:bg-gray-100'
        )}
        aria-expanded={open}
      >
        <Plus className="w-4 h-4" strokeWidth={2} />
        Create
        <ChevronDown
          className={cn(
            'w-3 h-3 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden animate-fade-in z-50"
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Create New
            </div>
          </div>

          <div className="py-1 max-h-[400px] overflow-y-auto">
            {visibleActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  setOpen(false);
                  action.onClick();
                }}
                className="w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                role="menuitem"
              >
                <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <action.icon
                    className="w-3.5 h-3.5 text-gray-600"
                    strokeWidth={1.75}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-gray-900">
                    {action.label}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {action.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
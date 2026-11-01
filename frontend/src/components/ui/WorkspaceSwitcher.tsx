import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useWorkspace } from '@/lib/workspace';
import { cn } from '@/lib/utils';

interface WorkspaceSwitcherProps {
  compact?: boolean;
}

export function WorkspaceSwitcher({ compact = false }: WorkspaceSwitcherProps) {
  const { workspaces, active, loading, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (loading || workspaces.length < 2 || !active) {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Workspace: ${active.name}`}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5',
          'text-[13px] font-medium text-gray-700 hover:bg-white hover:border-gray-300 transition-colors',
        )}
      >
        <Building2 className="w-4 h-4 text-primary" strokeWidth={1.75} />
        {!compact && (
          <span className="max-w-[120px] truncate">{active.name}</span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" strokeWidth={2} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-64 rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Workspace
            </p>
          </div>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              role="option"
              aria-selected={workspace.id === active.id}
              onClick={() => {
                switchWorkspace(workspace.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors',
                workspace.id === active.id && 'bg-gray-50',
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium text-gray-900">
                  {workspace.name}
                </span>
                <span className="block text-[11px] text-gray-400">
                  {workspace.code} · {workspace.currency}
                </span>
              </span>
              {workspace.id === active.id && (
                <Check className="w-4 h-4 text-primary" strokeWidth={2.25} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

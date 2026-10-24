import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function ChatModalShell({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  className,
  bodyClassName,
}: ChatModalShellProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-gray-900/50 px-0 pt-12 backdrop-blur-[2px] sm:items-center sm:px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl animate-fade-in sm:max-w-lg sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          {icon && (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto px-5 py-4 sm:px-6',
            bodyClassName,
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-shrink-0 items-center gap-2 border-t border-gray-100 px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

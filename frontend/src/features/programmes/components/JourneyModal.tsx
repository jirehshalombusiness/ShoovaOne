import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputClass =
  'w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-primary/20';

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  onSave,
  isSaving,
  saveLabel = 'Save',
  wide = false,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveLabel?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-white rounded-lg w-full shadow-xl max-h-[88vh] flex flex-col',
          wide ? 'max-w-2xl' : 'max-w-lg',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-md text-sm font-medium bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
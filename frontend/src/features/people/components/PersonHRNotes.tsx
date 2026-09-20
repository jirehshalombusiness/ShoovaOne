import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, StickyNote, Shield, X, Send } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hrService, type EmployeeDetail } from '@/services/hr.service';
import { cn } from '@/lib/utils';

interface Props {
  personId: string;
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  canEdit: boolean;
  onMutated: () => void;
}

export function PersonHRNotes({
  personId,
  employee,
  isLoading,
  canEdit,
  onMutated,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  const notes = employee?.notes ?? [];

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        </div>
      )}

      {notes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">No HR notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const categoryStyles: Record<string, string> = {
              general: 'bg-gray-100 text-gray-700',
              performance: 'bg-blue-50 text-blue-700',
              praise: 'bg-emerald-50 text-emerald-700',
              warning: 'bg-amber-50 text-amber-700',
              disciplinary: 'bg-red-50 text-red-700',
            };
            return (
              <div
                key={note.id}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    {note.title && (
                      <h4 className="text-sm font-semibold text-gray-900">
                        {note.title}
                      </h4>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                      {note.author_name && <span>{note.author_name}</span>}
                      {note.author_name && <span>·</span>}
                      <span>
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      {note.is_sensitive && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-amber-700">
                            <Shield className="w-3 h-3" />
                            Sensitive
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
                      categoryStyles[note.category] ?? categoryStyles.general,
                    )}
                  >
                    {note.category}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">
                  {note.content}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <AddNoteModal
          personId={personId}
          onClose={() => setShowModal(false)}
          onSuccess={onMutated}
        />
      )}
    </div>
  );
}

function AddNoteModal({
  personId,
  onClose,
  onSuccess,
}: {
  personId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    category: 'general',
    title: '',
    content: '',
    is_sensitive: true,
  });

  const mutation = useMutation({
    mutationFn: () =>
      hrService.createEmployeeNote(personId, {
        category: form.category,
        title: form.title || undefined,
        content: form.content,
        is_sensitive: form.is_sensitive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', personId] });
      toast.success('Note added');
      onSuccess();
      onClose();
    },
    onError: () => toast.error('Failed to add note'),
  });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add HR Note</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="general">General</option>
              <option value="performance">Performance</option>
              <option value="praise">Praise</option>
              <option value="warning">Warning</option>
              <option value="disciplinary">Disciplinary</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary…"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Content <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_sensitive}
              onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })}
              className="rounded border-gray-300"
            />
            Mark as sensitive
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.content.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {mutation.isPending ? 'Adding…' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
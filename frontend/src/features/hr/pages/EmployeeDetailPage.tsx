import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  FileText,
  StickyNote,
  FolderKanban,
  CheckSquare,
  Plus,
  AlertCircle,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

type Tab = 'overview' | 'documents' | 'notes' | 'work';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['hr', 'employee', id],
    queryFn: () => hrService.getEmployee(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Employee not found</p>
      </div>
    );
  }

  const { person } = employee;

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'notes', label: 'HR Notes', icon: StickyNote },
    { id: 'work', label: 'Work', icon: FolderKanban },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button
        onClick={() => navigate('/hr/employees')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Employees
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start gap-6">
          <Avatar
            firstName={person.first_name}
            lastName={person.last_name}
            imageUrl={person.profile_image_url}
            size="2xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {person.first_name} {person.last_name}
              </h1>
              <span
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                  person.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-100 text-gray-600'
                )}
              >
                {person.status || 'active'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
              {person.job_title && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  {person.job_title}
                </span>
              )}
              {person.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {person.location}
                </span>
              )}
              <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-700 rounded capitalize">
                {person.type}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 flex-wrap">
              {person.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {person.email}
                </span>
              )}
              {person.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {person.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab employee={employee} />}
      {tab === 'documents' && <DocumentsTab employee={employee} />}
      {tab === 'notes' && (
        <NotesTab employee={employee} onAdd={() => setShowNoteModal(true)} />
      )}
      {tab === 'work' && <WorkTab employee={employee} />}

      {/* Add note modal */}
      {showNoteModal && (
        <AddNoteModal
          personId={person.id}
          onClose={() => setShowNoteModal(false)}
        />
      )}
    </div>
  );
}

/* ============ OVERVIEW ============ */
function OverviewTab({ employee }: { employee: any }) {
  const { person } = employee;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Contact
          </h3>
          <div className="space-y-2 text-sm">
            <InfoRow label="Email" value={person.email} />
            <InfoRow label="Phone" value={person.phone} />
            <InfoRow label="Address" value={person.address} />
            <InfoRow
              label="City"
              value={[person.city, person.country].filter(Boolean).join(', ')}
            />
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Emergency Contact
          </h3>
          <div className="space-y-2 text-sm">
            <InfoRow label="Name" value={person.emergency_contact_name} />
            <InfoRow label="Phone" value={person.emergency_contact_phone} />
            <InfoRow
              label="Relationship"
              value={person.emergency_contact_relationship}
            />
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Personal
          </h3>
          <div className="space-y-2 text-sm">
            <InfoRow
              label="Date of Birth"
              value={
                person.date_of_birth
                  ? format(new Date(person.date_of_birth), 'MMMM d, yyyy')
                  : null
              }
            />
            <InfoRow label="Gender" value={person.gender} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right">{value || '—'}</span>
    </div>
  );
}

/* ============ DOCUMENTS ============ */
function DocumentsTab({ employee }: { employee: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Documents ({employee.documents.length})
        </h3>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Upload
        </button>
      </div>

      {employee.documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">No documents on file</p>
          <p className="text-xs text-gray-400 mt-1">
            Upload contracts, IDs, and certifications
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {employee.documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-gray-900 hover:text-primary transition-colors truncate block"
                >
                  {doc.name}
                </a>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {format(new Date(doc.created_at), 'MMM d, yyyy')}
                </div>
              </div>
              {doc.verified && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                  Verified
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ NOTES ============ */
function NotesTab({ employee, onAdd }: { employee: any; onAdd: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          HR Notes ({employee.notes.length})
        </h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Note
        </button>
      </div>

      {employee.notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">No HR notes yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Document performance discussions, warnings, praise
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {employee.notes.map((note: any) => (
            <div
              key={note.id}
              className="border border-gray-200 rounded-md p-3"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  {note.title && (
                    <div className="text-sm font-semibold text-gray-900">
                      {note.title}
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {note.author_first_name} {note.author_last_name} ·{' '}
                    {format(new Date(note.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                    note.category === 'warning'
                      ? 'bg-red-50 text-red-700'
                      : note.category === 'praise'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {note.category}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ WORK ============ */
function WorkTab({ employee }: { employee: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderKanban className="w-4 h-4" strokeWidth={1.75} />
          Projects ({employee.projects.length})
        </h3>
        {employee.projects.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            Not a member of any project
          </p>
        ) : (
          <div className="space-y-2">
            {employee.projects.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {p.name}
                  </div>
                  {p.code && (
                    <div className="text-[10px] text-gray-500 font-mono">
                      {p.code}
                    </div>
                  )}
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-600">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckSquare className="w-4 h-4" strokeWidth={1.75} />
          Open Tasks ({employee.tasks.length})
        </h3>
        {employee.tasks.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            No open tasks assigned
          </p>
        ) : (
          <div className="space-y-2">
            {employee.tasks.map((t: any) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm text-gray-900 truncate">{t.title}</div>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {t.due_date ? format(new Date(t.due_date), 'MMM d') : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ ADD NOTE MODAL ============ */
function AddNoteModal({
  personId,
  onClose,
}: {
  personId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    category: 'general',
    title: '',
    content: '',
  });

  const mutation = useMutation({
    mutationFn: () => hrService.createNote(personId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', personId] });
      toast.success('Note added');
      onClose();
    },
    onError: () => toast.error('Failed to add note'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Add HR Note</h3>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
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
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
              placeholder="Brief summary..."
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
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none"
              placeholder="Details..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.content.trim()}
              className="px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
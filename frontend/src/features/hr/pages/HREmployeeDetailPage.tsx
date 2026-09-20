import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  DollarSign,
  Clock,
  UserX,
  History,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  hrService,
  type EmployeeDetail,
  type EmployeeNote,
} from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'contracts' | 'time-off' | 'documents' | 'notes' | 'work' | 'timeline';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function HREmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const access = useHRAccess();
  const [tab, setTab] = useState<Tab>('overview');
  const isValidId = !!id && UUID_RE.test(id);

const { data, isLoading, error } = useQuery({
  queryKey: ['hr', 'employee', id],
  queryFn: () => hrService.getEmployee(id!),
  enabled: isValidId,
});

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/hr/employees')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employees
        </button>
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">Page not found</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/hr/employees')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Employees
        </button>
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Could not load employee
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {(error as Error)?.message ?? 'The employee may have been deleted.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { person } = data;

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'contracts', label: 'Contracts', icon: FileText, count: data.contracts.length },
    { id: 'time-off', label: 'Time Off', icon: Calendar, count: data.leave_balances.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: data.documents.length },
    { id: 'notes', label: 'HR Notes', icon: StickyNote, count: data.notes.length },
    { id: 'work', label: 'Work', icon: FolderKanban, count: data.projects.length + data.tasks.length },
    { id: 'timeline', label: 'Timeline', icon: History },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border border-gray-200 rounded-lg bg-white p-6">
        <div className="flex items-start gap-5 flex-wrap lg:flex-nowrap">
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
                    : person.status === 'terminated'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-gray-100 text-gray-600',
                )}
              >
                {person.status || 'active'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                {person.type}
              </span>
              {person.employee_number && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700">
                  {person.employee_number}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-sm text-gray-600">
              {person.job_title && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-gray-400" />
                  {person.job_title}
                </span>
              )}
              {person.department && (
                <span className="flex items-center gap-1.5">
                  <FolderKanban className="w-4 h-4 text-gray-400" />
                  {person.department}
                </span>
              )}
              {person.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {person.location}
                </span>
              )}
              {person.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {person.email}
                </span>
              )}
              {person.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {person.phone}
                </span>
              )}
            </div>

            {data.manager && (
              <div className="mt-3 text-xs text-gray-500">
                Reports to{' '}
                <button
                  onClick={() => navigate(`/hr/employees/${data.manager!.id}`)}
                  className="font-medium text-gray-800 hover:text-primary transition-colors"
                >
                  {data.manager.first_name} {data.manager.last_name}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
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
                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums',
                      active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab employee={data} />}
      {tab === 'contracts' && <ContractsTab employee={data} />}
      {tab === 'time-off' && <TimeOffTab employee={data} />}
      {tab === 'documents' && <DocumentsTab employee={data} />}
      {tab === 'notes' && <NotesTab employee={data} canEdit={access.canEditSensitive} />}
      {tab === 'work' && <WorkTab employee={data} />}
      {tab === 'timeline' && <TimelineTab personId={person.id} />}
    </div>
  );
}

// ============================================================
// OVERVIEW TAB
// ============================================================

function OverviewTab({ employee }: { employee: EmployeeDetail }) {
  const { person } = employee;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Contact */}
      <div className="lg:col-span-2 border border-gray-200 rounded-lg bg-white p-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Contact Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow icon={Mail} label="Email" value={person.email} />
          <InfoRow icon={Phone} label="Phone" value={person.phone} />
          <InfoRow
            icon={MapPin}
            label="Address"
            value={
              [person.address, person.city, person.state, person.country]
                .filter(Boolean)
                .join(', ') || null
            }
            className="md:col-span-2"
          />
          <InfoRow
            icon={Calendar}
            label="Date of Birth"
            value={
              person.date_of_birth
                ? format(new Date(person.date_of_birth), 'MMMM d, yyyy')
                : null
            }
          />
          <InfoRow icon={User} label="Gender" value={person.gender} />
        </div>

        {(person.emergency_contact_name || person.emergency_contact_phone) && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-4">
              Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <InfoRow label="Name" value={person.emergency_contact_name} />
              <InfoRow label="Phone" value={person.emergency_contact_phone} />
              <InfoRow
                label="Relationship"
                value={person.emergency_contact_relationship}
              />
            </div>
          </>
        )}

        {person.bio && (
          <>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2">
              About
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.bio}</p>
          </>
        )}
      </div>

      {/* Right column — org + direct reports */}
      <div className="space-y-4">
        {/* Manager */}
        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Reports To
          </h3>
          {employee.manager ? (
            <div className="flex items-center gap-3">
              <Avatar
                firstName={employee.manager.first_name}
                lastName={employee.manager.last_name}
                imageUrl={employee.manager.profile_image_url}
                size="sm"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-900 truncate">
                  {employee.manager.first_name} {employee.manager.last_name}
                </div>
                {employee.manager.job_title && (
                  <div className="text-[11px] text-gray-500 truncate">
                    {employee.manager.job_title}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No manager assigned</p>
          )}
        </div>

        {/* Direct reports */}
        <div className="border border-gray-200 rounded-lg bg-white p-5">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Direct Reports ({employee.direct_reports.length})
          </h3>
          {employee.direct_reports.length === 0 ? (
            <p className="text-xs text-gray-500">No direct reports</p>
          ) : (
            <div className="space-y-2">
              {employee.direct_reports.slice(0, 6).map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <Avatar
                    firstName={r.first_name}
                    lastName={r.last_name}
                    imageUrl={r.profile_image_url}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-gray-900 truncate">
                      {r.first_name} {r.last_name}
                    </div>
                    {r.job_title && (
                      <div className="text-[10px] text-gray-500 truncate">
                        {r.job_title}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {employee.direct_reports.length > 6 && (
                <div className="text-[11px] text-gray-500 pt-1">
                  +{employee.direct_reports.length - 6} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Skills */}
        {person.skills && (
          <div className="border border-gray-200 rounded-lg bg-white p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Skills
            </h3>
            <p className="text-sm text-gray-700">{person.skills}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: React.ElementType;
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {Icon && <Icon className="w-3 h-3 text-gray-400" />}
        {label}
      </div>
      <div className="text-[13px] text-gray-900">{value || '—'}</div>
    </div>
  );
}

// ============================================================
// CONTRACTS TAB
// ============================================================

function ContractsTab({ employee }: { employee: EmployeeDetail }) {
  const contracts = employee.contracts;

  if (contracts.length === 0) {
    return <EmptyState icon={FileText} title="No contracts on file" />;
  }

  const current = contracts.find((c) => c.is_current);
  const history = contracts.filter((c) => !c.is_current);

  return (
    <div className="space-y-4">
      {current && (
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900 capitalize">
                  {current.contract_type.replace(/_/g, ' ')}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                  Current
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Started {format(new Date(current.start_date), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
            <InfoRow label="Position" value={current.position} />
            <InfoRow label="Department" value={current.department} />
            <InfoRow label="Reports To" value={current.reports_to_name} />
            <InfoRow
              label="Start Date"
              value={format(new Date(current.start_date), 'MMM d, yyyy')}
            />
            {current.end_date && (
              <InfoRow
                label="End Date"
                value={format(new Date(current.end_date), 'MMM d, yyyy')}
              />
            )}
            {current.compensation_amount && (
              <InfoRow
                icon={DollarSign}
                label="Compensation"
                value={`${current.compensation_currency} ${current.compensation_amount.toLocaleString()} / ${current.compensation_frequency}`}
              />
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            History ({history.length})
          </h3>
          <div className="space-y-3">
            {history.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 p-3 rounded-md border border-gray-100"
              >
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 capitalize">
                    {c.contract_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {format(new Date(c.start_date), 'MMM d, yyyy')}
                    {c.end_date &&
                      ` – ${format(new Date(c.end_date), 'MMM d, yyyy')}`}
                    {c.position && ` · ${c.position}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TIME OFF TAB
// ============================================================

function TimeOffTab({ employee }: { employee: EmployeeDetail }) {
  const balances = employee.leave_balances;

  if (balances.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No leave balances configured"
        subtitle="Set up balances in HR → Time Off"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {balances.map((b) => {
        const usedPct =
          b.total_days > 0 ? (b.used_days / b.total_days) * 100 : 0;
        const pendingPct =
          b.total_days > 0 ? (b.pending_days / b.total_days) * 100 : 0;

        return (
          <div key={b.id} className="border border-gray-200 rounded-lg bg-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: b.leave_type_color }}
              />
              <span className="text-[13px] font-medium text-gray-700">
                {b.leave_type_name}
              </span>
              <span className="text-[10px] text-gray-400 ml-auto">{b.year}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 tabular-nums">
              {b.remaining_days.toFixed(1)}
              <span className="text-sm font-normal text-gray-500 ml-1">days left</span>
            </div>
            <div className="mt-3 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, usedPct)}%`,
                  backgroundColor: b.leave_type_color,
                }}
              />
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.min(100, pendingPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1.5">
              <span>
                {b.used_days.toFixed(1)} used
                {b.pending_days > 0 && ` · ${b.pending_days.toFixed(1)} pending`}
              </span>
              <span>{b.total_days.toFixed(1)} total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// DOCUMENTS TAB
// ============================================================

function DocumentsTab({ employee }: { employee: EmployeeDetail }) {
  const documents = employee.documents;

  if (documents.length === 0) {
    return <EmptyState icon={FileText} title="No documents on file" />;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
          <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-900 hover:text-primary transition-colors truncate block"
            >
              {doc.name}
            </a>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {doc.created_at && format(new Date(doc.created_at), 'MMM d, yyyy')}
              {doc.expiry_date && (
                <>
                  {' · '}expires {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                </>
              )}
            </div>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
              doc.verified
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {doc.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// NOTES TAB
// ============================================================

function NotesTab({
  employee,
  canEdit,
}: {
  employee: EmployeeDetail;
  canEdit: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const notes = employee.notes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          HR Notes ({notes.length})
        </h3>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        )}
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No HR notes yet"
          subtitle="Document performance, praise, warnings, and other sensitive notes here"
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}

      {showModal && (
        <AddNoteModal
          personId={employee.person.id}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function NoteCard({ note }: { note: EmployeeNote }) {
  const categoryStyles: Record<string, string> = {
    general: 'bg-gray-100 text-gray-700',
    performance: 'bg-blue-50 text-blue-700',
    praise: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    disciplinary: 'bg-red-50 text-red-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {note.title && (
            <h4 className="text-sm font-semibold text-gray-900">{note.title}</h4>
          )}
          <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
            {note.author_name && <span>{note.author_name}</span>}
            {note.author_name && <span>·</span>}
            <span>{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}</span>
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
      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{note.content}</p>
    </div>
  );
}

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
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Add HR Note</h3>
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
              placeholder="Details…"
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
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Add Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// WORK TAB
// ============================================================

function WorkTab({ employee }: { employee: EmployeeDetail }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="border border-gray-200 rounded-lg bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-gray-400" />
          Projects ({employee.projects.length})
        </h3>
        {employee.projects.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            Not a member of any project
          </p>
        ) : (
          <div className="space-y-2">
            {employee.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 truncate">
                    {p.name}
                  </div>
                  {p.code && (
                    <div className="text-[10px] text-gray-500 font-mono">{p.code}</div>
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

      <div className="border border-gray-200 rounded-lg bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-gray-400" />
          Open Tasks ({employee.tasks.length})
        </h3>
        {employee.tasks.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">
            No open tasks assigned
          </p>
        ) : (
          <div className="space-y-2">
            {employee.tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="text-[13px] text-gray-900 truncate">{t.title}</div>
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

// ============================================================
// TIMELINE TAB
// ============================================================

function TimelineTab({ personId }: { personId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'employee', personId, 'timeline'],
    queryFn: () => hrService.getEmployeeTimeline(personId, { limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const entries = data ?? [];

  if (entries.length === 0) {
    return <EmptyState icon={History} title="No activity recorded yet" />;
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-3 px-5 py-4">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-semibold text-gray-900 uppercase tracking-wider">
                  {entry.action.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-gray-400">
                  {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {entry.description && (
                <p className="text-[13px] text-gray-700 mt-1">{entry.description}</p>
              )}
              {entry.actor_name && (
                <p className="text-[11px] text-gray-500 mt-1">
                  by {entry.actor_name}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// EMPTY STATE
// ============================================================

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
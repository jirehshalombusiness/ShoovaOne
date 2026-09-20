import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  ChevronRight,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hrService, type HRDocumentAdmin } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { useHRAccess } from '@/hooks/useHRAccess';
import { cn } from '@/lib/utils';

export function HRDocumentsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const access = useHRAccess();

  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'unverified' | 'verified'>('all');
  const [expiringFilter, setExpiringFilter] = useState<'all' | 'expiring' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const typesQuery = useQuery({
    queryKey: ['hr', 'documents', 'types'],
    queryFn: () => hrService.listDocumentTypes(),
  });

  const docsQuery = useQuery({
    queryKey: [
      'hr',
      'documents',
      verifiedFilter,
      expiringFilter,
      typeFilter,
      debouncedSearch,
    ],
    queryFn: () => {
      const params: Parameters<typeof hrService.listDocuments>[0] = {
        limit: 500,
      };
      if (verifiedFilter === 'unverified') params.verified = false;
      if (verifiedFilter === 'verified') params.verified = true;
      if (expiringFilter === 'expiring') params.expiring_in_days = 30;
      if (expiringFilter === 'expired') params.expired_only = true;
      if (typeFilter) params.document_type_id = typeFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      return hrService.listDocuments(params);
    },
  });

  const types = typesQuery.data ?? [];
  const data = docsQuery.data;
  const documents = data?.items ?? [];

  const hasFilters =
    verifiedFilter !== 'all' ||
    expiringFilter !== 'all' ||
    !!typeFilter ||
    search.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Compliance, verification, and expiry tracking across the organisation
          </p>
        </div>
        <button
          onClick={() => navigate('/hr/documents/types')}
          className="hidden"
        >
          Document Types
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ShieldCheck}
          label="Total Documents"
          value={data?.total ?? '—'}
          sub="on file"
          tone="default"
        />
        <KpiCard
          icon={Shield}
          label="Unverified"
          value={data?.unverified ?? '—'}
          sub="need review"
          tone="warning"
        />
        <KpiCard
          icon={Clock}
          label="Expiring Soon"
          value={data?.expiring_30 ?? '—'}
          sub="within 30 days"
          tone="info"
        />
        <KpiCard
          icon={AlertCircle}
          label="Expired"
          value={data?.expired ?? '—'}
          sub="overdue"
          tone="danger"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* Verified filter */}
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'unverified', label: 'Unverified' },
              { value: 'verified', label: 'Verified' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setVerifiedFilter(f.value as typeof verifiedFilter)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  verifiedFilter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:block w-px h-6 bg-gray-200" />

          {/* Expiry filter */}
          <div className="flex items-center gap-1">
            {[
              { value: 'all', label: 'Any' },
              { value: 'expiring', label: 'Expiring ≤30d' },
              { value: 'expired', label: 'Expired' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setExpiringFilter(f.value as typeof expiringFilter)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  expiringFilter === f.value
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All document types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by document or employee name…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setVerifiedFilter('all');
                setExpiringFilter('all');
                setTypeFilter('');
                setSearch('');
              }}
              className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {docsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {hasFilters ? 'No documents match your filters' : 'No documents on file'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* Table head */}
          <div className="hidden lg:grid grid-cols-[minmax(200px,1.5fr)_minmax(240px,2fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(140px,1fr)_100px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Employee</div>
            <div>Document</div>
            <div>Type</div>
            <div>Expiry</div>
            <div>Status</div>
            <div />
          </div>

          <div className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                canVerify={access.canEditSensitive}
                onMutated={() =>
                  queryClient.invalidateQueries({ queryKey: ['hr', 'documents'] })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KPI
// ============================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub: string;
  tone: 'default' | 'warning' | 'info' | 'danger';
}) {
  const iconColor = {
    default: 'text-gray-400',
    warning: 'text-amber-500',
    info: 'text-blue-500',
    danger: 'text-red-500',
  }[tone];

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className={cn('w-4 h-4', iconColor)} strokeWidth={1.75} />
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

// ============================================================
// ROW
// ============================================================

function DocumentRow({
  document,
  canVerify,
  onMutated,
}: {
  document: HRDocumentAdmin;
  canVerify: boolean;
  onMutated: () => void;
}) {
  const navigate = useNavigate();
  const [confirmReject, setConfirmReject] = useState(false);

  const verifyMutation = useMutation({
    mutationFn: () => hrService.verifyDocument(document.id),
    onSuccess: () => {
      onMutated();
      toast.success('Document verified');
    },
    onError: () => toast.error('Failed to verify'),
  });

  const unverifyMutation = useMutation({
    mutationFn: () => hrService.unverifyDocument(document.id),
    onSuccess: () => {
      onMutated();
      setConfirmReject(false);
      toast.success('Verification removed');
    },
    onError: () => toast.error('Failed to unverify'),
  });

  // Expiry status
  let expiryLabel: string = '—';
  let expiryTone: 'default' | 'warning' | 'danger' = 'default';

  if (document.expiry_date) {
    const exp = new Date(document.expiry_date);
    const days = Math.floor((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) {
      expiryLabel = `Expired ${Math.abs(days)}d ago`;
      expiryTone = 'danger';
    } else if (days <= 30) {
      expiryLabel = `In ${days}d`;
      expiryTone = 'warning';
    } else {
      expiryLabel = format(exp, 'MMM d, yyyy');
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,1.5fr)_minmax(240px,2fr)_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(140px,1fr)_100px] gap-4 px-5 py-3 hover:bg-gray-50 transition-colors items-center">
      {/* Employee */}
      {document.owner ? (
        <button
          onClick={() => navigate(`/hr/employees/${document.owner!.id}`)}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <Avatar
            firstName={document.owner.first_name}
            lastName={document.owner.last_name}
            imageUrl={document.owner.profile_image_url}
            size="sm"
          />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 truncate">
              {document.owner.first_name} {document.owner.last_name}
            </div>
            {document.owner.department && (
              <div className="text-[11px] text-gray-500 truncate">
                {document.owner.department}
              </div>
            )}
          </div>
        </button>
      ) : (
        <span className="text-[12px] text-gray-400">—</span>
      )}

      {/* Document */}
      <div className="min-w-0">
        <a
          href={document.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[13px] font-medium text-gray-900 hover:text-primary transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{document.name}</span>
        </a>
        {document.verified_by_name && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            Verified by {document.verified_by_name}
          </div>
        )}
      </div>

      {/* Type */}
      <div className="text-[12px] text-gray-600 truncate">
        {document.document_type_name ?? <span className="text-gray-400">Untyped</span>}
      </div>

      {/* Expiry */}
      <div
        className={cn(
          'text-[12px] font-medium tabular-nums',
          expiryTone === 'danger' && 'text-red-600',
          expiryTone === 'warning' && 'text-amber-600',
          expiryTone === 'default' && 'text-gray-700',
        )}
      >
        {expiryLabel}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {document.verified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-2.5 h-2.5" />
            Pending
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 justify-end">
        {canVerify && !document.verified && (
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending}
            className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {verifyMutation.isPending ? '…' : 'Verify'}
          </button>
        )}
        {canVerify && document.verified && (
          <button
            onClick={() => {
              if (confirmReject) {
                unverifyMutation.mutate();
              } else {
                setConfirmReject(true);
                setTimeout(() => setConfirmReject(false), 3000);
              }
            }}
            disabled={unverifyMutation.isPending}
            className={cn(
              'px-2.5 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-50',
              confirmReject
                ? 'bg-red-600 text-white'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
            )}
          >
            {unverifyMutation.isPending
              ? '…'
              : confirmReject
                ? 'Confirm?'
                : 'Unverify'}
          </button>
        )}
      </div>
    </div>
  );
}
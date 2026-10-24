import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  X,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  organisationService,
  type Organisation,
  type OrganisationCreatePayload,
} from '@/services/organisation.service';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-50 text-red-700',
};

export function CrmOrganisationsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('organisation.manage');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['crm', 'organisations', { status: statusFilter }],
    queryFn: () =>
      organisationService.list({
        status: statusFilter || undefined,
        limit: 500,
      }),
  });

  const organisations = useMemo(() => {
    const items = data?.items ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        (o.code || '').toLowerCase().includes(q) ||
        (o.description || '').toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Organisations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.total ?? 0} organisations in the directory
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Organisation
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or description…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                statusFilter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <p className="text-sm font-semibold text-red-900">
            Could not load organisations
          </p>
          <p className="text-xs text-red-700 mt-1">
            {(error as Error)?.message ?? 'Please try again.'}
          </p>
        </div>
      ) : organisations.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {search || statusFilter
              ? 'No organisations match your filters'
              : 'No organisations yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {search || statusFilter
              ? 'Try a different search or filter'
              : 'Create your first organisation to start tracking opportunities'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
          {organisations.map((org) => (
            <OrgRow key={org.id} organisation={org} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateOrganisationModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['crm', 'organisations'] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// ROW
// ============================================================

function OrgRow({ organisation }: { organisation: Organisation }) {
  const navigate = useNavigate();
  const statusStyle =
    STATUS_STYLES[organisation.status] ?? STATUS_STYLES.inactive;

  return (
    <button
      onClick={() => navigate(`/crm/organisations/${organisation.id}`)}
      className="w-full flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-5 h-5 text-gray-500" strokeWidth={1.75} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-semibold text-gray-900">
            {organisation.name}
          </span>
          {organisation.code && (
            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-semibold uppercase tracking-wider">
              {organisation.code}
            </span>
          )}
          <span
            className={cn(
              'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
              statusStyle,
            )}
          >
            {organisation.status}
          </span>
        </div>

        {organisation.description && (
          <div className="text-[11px] text-gray-600 mt-1 line-clamp-1">
            {organisation.description}
          </div>
        )}

        <div className="text-[11px] text-gray-500 mt-1">
          Added {formatDate(organisation.created_at)}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-2" />
    </button>
  );
}

// ============================================================
// CREATE MODAL
// ============================================================

function CreateOrganisationModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: (payload: OrganisationCreatePayload) =>
      organisationService.create(payload),
    onSuccess: () => {
      toast.success('Organisation created');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ?? 'Failed to create organisation',
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      code: code.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-lg w-full shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              New Organisation
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Add a partner, funder, or contact organisation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ghana Education Service"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. GES"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Optional short code used across projects and finance.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this organisation to Shoova?"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending || !name.trim()}
            className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Organisation'}
          </button>
        </div>
      </div>
    </div>
  );
}

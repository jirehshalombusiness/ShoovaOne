import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { peopleService, OrgNode } from '@/services/people.service';
import { Avatar } from '@/components/ui/Avatar';
import { ChevronDown, ChevronRight, Users, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usePermissions } from '@/hooks/usePermissions';
import { Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

interface TreeNode extends OrgNode {
  children: TreeNode[];
}

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));

  nodes.forEach((n) => {
    const node = map.get(n.id)!;
    if (n.reports_to_id && map.has(n.reports_to_id)) {
      map.get(n.reports_to_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.first_name.localeCompare(b.first_name));
    node.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  return roots;
}

function OrgNodeCard({
  node,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
  onEdit,
}: {
  node: TreeNode;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        onClick={onSelect}
        className="group relative bg-white border border-gray-200 rounded-lg px-3 py-2 w-[170px] hover:border-primary hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Avatar
            firstName={node.first_name}
            lastName={node.last_name}
            imageUrl={node.profile_image_url}
            size="md"
            className="ring-2 ring-white"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-gray-900 leading-tight truncate">
              {node.first_name}
            </div>
            <div className="text-[11px] font-semibold text-gray-900 leading-tight truncate">
              {node.last_name}
            </div>
            {node.job_title && (
              <div className="text-[9px] text-gray-500 mt-0.5 leading-tight line-clamp-2">
                {node.job_title}
              </div>
            )}
          </div>
        </div>

        {node.location && (
          <div className="text-[8px] text-gray-400 mt-1 truncate">{node.location}</div>
        )}

        {node.direct_reports_count > 0 && (
          <div className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
            {node.direct_reports_count}
          </div>
        )}

        {/* Edit button — HR only */}
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Change manager"
            className="absolute top-1 right-1 p-1 rounded-md bg-white/90 border border-gray-200 opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-white transition-all"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={cn(
            'mt-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium transition-colors',
            expanded
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          {expanded ? (
            <>
              <ChevronDown className="w-2.5 h-2.5" />
              {node.children.length}
            </>
          ) : (
            <>
              <ChevronRight className="w-2.5 h-2.5" />
              {node.children.length}
            </>
          )}
        </button>
      )}
    </div>
  );
}

function OrgSubTree({
  node,
  onSelect,
  onEdit,
  horizontalGap,
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
  onEdit?: (id: string) => void;
  horizontalGap: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      <OrgNodeCard
        node={node}
        expanded={expanded}
        hasChildren={hasChildren}
        onToggle={() => setExpanded((v) => !v)}
        onSelect={() => onSelect(node.id)}
        onEdit={onEdit ? () => onEdit(node.id) : undefined}
      />

      {hasChildren && expanded && (
        <>
          <div className="w-px h-5 bg-gray-200" />
          <div className="relative flex pt-5" style={{ gap: `${horizontalGap}px` }}>
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 flex justify-center">
                <div
                  className="h-px bg-gray-200"
                  style={{
                    width: `calc(100% - 170px)`,
                    marginLeft: '85px',
                    marginRight: '85px',
                  }}
                />
              </div>
            )}

            {node.children.map((child) => (
              <div key={child.id} className="relative">
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-px h-5 bg-gray-200" />
                <OrgSubTree
                  node={child}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  horizontalGap={horizontalGap}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
export function OrgChartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('hr.edit_employment');

  const [zoom, setZoom] = useState(100);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.get('/hr/org-chart').then((r) => r.data),
  });

  const tree = useMemo(() => {
    if (!data || !data.nodes) return [];
    return buildTree(data.nodes);
  }, [data]);

  const horizontalGap = Math.max(12, Math.round(32 * (zoom / 100)));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-gray-700 font-medium">Could not load org chart</p>
        <p className="text-sm text-gray-500 mt-1">Try refreshing the page.</p>
      </div>
    );
  }

  if (!data || tree.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No active people to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organisation Chart</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Reporting structure across Shoova Initiative
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <span className="text-[11px] font-medium text-gray-700 min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(120, z + 10))}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
          <button
            onClick={() => setZoom(100)}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-900"
          >
            Reset
          </button>
          <div className="text-xs text-gray-500">
            {data.nodes.length} people
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-gray-500 bg-white border border-gray-200 rounded-md px-3 py-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
            4
          </div>
          Direct reports
        </div>
        <span className="text-gray-300">·</span>
        <span>Click a card to view profile</span>
        {canEdit && (
          <>
            <span className="text-gray-300">·</span>
            <span>Hover a card → click pencil to change manager</span>
          </>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 overflow-auto">
        <div
          className="flex justify-center min-w-fit transition-transform origin-top"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          <div className="flex flex-col items-center gap-6">
            {tree.map((root) => (
              <OrgSubTree
                key={root.id}
                node={root}
                onSelect={(id) => navigate(`/people/${id}`)}
                onEdit={canEdit ? (id) => setEditingPersonId(id) : undefined}
                horizontalGap={horizontalGap}
              />
            ))}
          </div>
        </div>
      </div>

      {editingPersonId && (
        <ChangeManagerModal
          personId={editingPersonId}
          people={data.nodes}
          onClose={() => setEditingPersonId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['org-chart'] });
            setEditingPersonId(null);
          }}
        />
      )}
    </div>
  );
}

function ChangeManagerModal({
  personId,
  people,
  onClose,
  onSuccess,
}: {
  personId: string;
  people: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const person = people.find((p) => p.id === personId);
  const [selectedManagerId, setSelectedManagerId] = useState<string>(
    person?.reports_to_id ?? '',
  );

  const mutation = useMutation({
    mutationFn: (managerId: string | null) =>
      api
        .patch(`/hr/org-chart/${personId}/reports-to`, {
          reports_to_id: managerId,
        })
        .then((r) => r.data),
    onSuccess: () => {
      toast.success('Manager updated');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to update manager');
    },
  });

  if (!person) return null;

  // Exclude the person themselves and their descendants from the picker
  // (basic guard; the backend also rejects cycles)
  const candidates = people.filter((p) => p.id !== personId);

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
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Change Manager
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {person.first_name} {person.last_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Reports To
            </label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">— No manager (top of chart) —</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                  {p.job_title ? ` — ${p.job_title}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate(selectedManagerId || null)}
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
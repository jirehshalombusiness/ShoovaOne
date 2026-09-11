import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { peopleService, OrgNode } from '@/services/people.service';
import { ChevronDown, ChevronRight, Users, AlertCircle, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

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

// Compact avatar with image fallback to initials
function Avatar({
  node,
  size = 'md',
}: {
  node: { first_name: string; last_name: string; profile_image_url: string | null };
  size?: 'sm' | 'md' | 'lg';
}) {
  const [imageError, setImageError] = useState(false);
  const initials = `${node.first_name?.[0] || ''}${node.last_name?.[0] || ''}`.toUpperCase();

  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-base',
  };

  const showImage = node.profile_image_url && !imageError;

  return (
    <div
      className={cn(
        'rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden ring-2 ring-white',
        sizeClasses[size]
      )}
    >
      {showImage ? (
        <img
          src={node.profile_image_url!}
          alt={`${node.first_name} ${node.last_name}`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-primary font-semibold">{initials}</span>
      )}
    </div>
  );
}

// Compact node card
function OrgNodeCard({
  node,
  expanded,
  hasChildren,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        onClick={onSelect}
        className="group relative bg-white border border-gray-200 rounded-lg px-3 py-2 w-[170px] hover:border-primary hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Avatar node={node} size="md" />
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

        {/* Direct reports badge */}
        {node.direct_reports_count > 0 && (
          <div className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
            {node.direct_reports_count}
          </div>
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
  horizontalGap,
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
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
      />

      {hasChildren && expanded && (
        <>
          {/* Vertical connector */}
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
  const [zoom, setZoom] = useState(100);

  const { data, isLoading, error } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => peopleService.getOrgChart(),
  });

  const tree = useMemo(() => {
    if (!data || !data.nodes) return [];
    return buildTree(data.nodes);
  }, [data]);

  // Horizontal gap shrinks as zoom decreases
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
        <p className="text-sm text-gray-500 mt-1">
          Try refreshing the page or contact your administrator.
        </p>
      </div>
    );
  }

  if (!data || tree.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No active people to display</p>
        <p className="text-sm text-gray-400 mt-1">
          Add people and set their reporting lines to see the org chart
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organisation Chart</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Reporting structure across Shoova Initiative
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <span className="text-[11px] font-medium text-gray-700 min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(120, z + 10))}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => setZoom(100)}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Reset
          </button>

          <div className="text-xs text-gray-500">
            {data.nodes.length} {data.nodes.length === 1 ? 'person' : 'people'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500 bg-white border border-gray-200 rounded-md px-3 py-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-primary text-white text-[8px] flex items-center justify-center font-bold">
            4
          </div>
          Direct reports
        </div>
        <span className="text-gray-300">·</span>
        <span>Click a card to view profile</span>
        <span className="text-gray-300">·</span>
        <span>Use zoom to fit the tree</span>
      </div>

      {/* Chart */}
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
                horizontalGap={horizontalGap}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
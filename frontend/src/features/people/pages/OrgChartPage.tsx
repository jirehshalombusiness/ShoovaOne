import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { peopleService, OrgNode } from '@/services/people.service';
import { ChevronDown, ChevronRight, Users, MapPin, AlertCircle } from 'lucide-react';
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
  const initials = `${node.first_name?.[0] || ''}${node.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={onSelect}
        className="group relative bg-white border border-gray-200 rounded-lg p-4 w-[220px] hover:border-primary hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg mb-2 flex-shrink-0">
            {initials}
          </div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {node.first_name} {node.last_name}
          </div>
          {node.job_title && (
            <div className="text-[11px] text-gray-500 mt-1 leading-tight line-clamp-2">
              {node.job_title}
            </div>
          )}
          {node.location && (
            <div className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              {node.location}
            </div>
          )}
        </div>

        {node.direct_reports_count > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-semibold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 border-2 border-white">
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
            'mt-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-colors',
            expanded
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" />
              Hide {node.children.length}
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              Show {node.children.length}
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
}: {
  node: TreeNode;
  onSelect: (id: string) => void;
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
          <div className="w-px h-8 bg-gray-200" />
          <div className="relative flex gap-6 pt-8">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 flex justify-center">
                <div
                  className="h-px bg-gray-200"
                  style={{
                    width: `calc(100% - ${220}px)`,
                    marginLeft: '110px',
                    marginRight: '110px',
                  }}
                />
              </div>
            )}

            {node.children.map((child) => (
              <div key={child.id} className="relative">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-200" />
                <OrgSubTree node={child} onSelect={onSelect} />
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

  // ✅ Fixed: use the proper org-chart endpoint
  const { data, isLoading, error } = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => peopleService.getOrgChart(),
  });

  const tree = useMemo(() => {
    if (!data || !data.nodes) return [];
    return buildTree(data.nodes);
  }, [data]);

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
          The org chart endpoint may not be available yet.
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organisation Chart</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reporting structure across Shoova Initiative
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {data.nodes.length} {data.nodes.length === 1 ? 'person' : 'people'}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 border border-gray-200 bg-white rounded-lg px-4 py-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-semibold">
            3
          </div>
          Direct reports
        </div>
        <div className="text-gray-300">·</div>
        <div>Click any card to view profile</div>
        <div className="text-gray-300">·</div>
        <div>Click toggle to expand/collapse</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-8 overflow-x-auto">
        <div className="flex justify-center min-w-fit">
          <div className="flex flex-col items-center gap-8">
            {tree.map((root) => (
              <OrgSubTree
                key={root.id}
                node={root}
                onSelect={(id) => navigate(`/people/${id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
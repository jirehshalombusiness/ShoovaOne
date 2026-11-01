import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { workspaceService, type Workspace } from '@/services/workspace.service';

const ENTITY_KEY = 'active_entity_id';
const OWNER_KEY = 'active_entity_owner';

interface WorkspaceContextType {
  workspaces: Workspace[];
  active: Workspace | null;
  loading: boolean;
  switchWorkspace: (entityId: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = useCallback(
    (workspace: Workspace, userId: string) => {
      localStorage.setItem(ENTITY_KEY, workspace.id);
      localStorage.setItem(OWNER_KEY, userId);
      setActive(workspace);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !userId) {
      setWorkspaces([]);
      setActive(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    workspaceService
      .list()
      .then((list) => {
        if (cancelled) return;
        setWorkspaces(list);

        const stored = localStorage.getItem(ENTITY_KEY);
        const owner = localStorage.getItem(OWNER_KEY);
        const storedIsValid =
          owner === userId && list.some((workspace) => workspace.id === stored);

        const next =
          (storedIsValid && list.find((workspace) => workspace.id === stored)) ||
          list.find((workspace) => workspace.is_default) ||
          list[0] ||
          null;

        if (next) {
          persist(next, userId);
        } else {
          setActive(null);
        }
      })
      .catch(() => {
        if (!cancelled) setActive(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId, persist]);

  const switchWorkspace = useCallback(
    (entityId: string) => {
      if (!userId) return;
      const next = workspaces.find((workspace) => workspace.id === entityId);
      if (!next || next.id === active?.id) return;
      persist(next, userId);
      queryClient.resetQueries();
    },
    [active?.id, persist, queryClient, userId, workspaces],
  );

  return (
    <WorkspaceContext.Provider
      value={{ workspaces, active, loading, switchWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

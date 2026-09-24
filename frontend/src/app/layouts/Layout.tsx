import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { cn } from '@/lib/utils';
import { sessionService } from '@/services/session.service';
import { useIdleDetection } from '@/hooks/useIdleDetection';
import { CheckInModal } from '@/features/attendance/components/CheckInModal';
import { useAuth } from '@/lib/auth';
import { attendanceService } from '@/services/attendance.service';

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const queryClient = useQueryClient();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Fetch today's session status.
  // Gated on auth being fully resolved AND user being present.
  const {
    data: sessionStatus,
    isLoading: sessionLoading,
  } = useQuery({
    queryKey: ['session', 'status'],
    queryFn: () => sessionService.getStatus(),
    enabled: isAuthenticated && !authLoading && !!user,
    refetchInterval: 60_000,
    // Don't retry 401/403 — they're auth errors, not transient
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    // Don't refetch on every mount when prefetched data is fresh
    staleTime: 10_000,
  });

  // Show modal on first meaningful session-status read.
  useEffect(() => {
    if (authLoading || sessionLoading) return;
    if (!isAuthenticated) return;
    if (!sessionStatus) return;

    if (!sessionStatus.has_attendance) {
      setShowCheckInModal(true);
    } else {
      setShowCheckInModal(false);
    }
  }, [sessionStatus, authLoading, sessionLoading, isAuthenticated]);

  // Idle detection
  useIdleDetection({
    idleMs: 15 * 60 * 1000,
    signOutMs: 30 * 60 * 1000,
    onIdle: async () => {
      await sessionService.pause();
      queryClient.invalidateQueries({ queryKey: ['session', 'status'] });
    },
    onReturn: () => {
      sessionService.heartbeat().then(() =>
        queryClient.invalidateQueries({ queryKey: ['session', 'status'] })
      );
    },
    onSignOut: async () => {
      await sessionService.autoEnd();
      toast.error('You were signed out due to inactivity. Log in again to resume.');
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    },
  });

  // Heartbeat every 5 minutes while active
  useEffect(() => {
    if (sessionStatus?.status !== 'active') return;
    const interval = setInterval(() => {
      sessionService.heartbeat();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionStatus?.status]);

  useEffect(() => {
  if (!showCheckInModal) return;
  queryClient.prefetchQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceService.getToday(),
    staleTime: 10_000,
  });
}, [showCheckInModal, queryClient]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      <MobileMenuDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div
        className={cn(
          'flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        )}
      >
        <TopBar onMenuClick={() => setDrawerOpen(true)} />

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        <MobileBottomNav onMoreClick={() => setDrawerOpen(true)} />
      </div>

      {showCheckInModal && (
        <CheckInModal
          onCheckedIn={() => {
            setShowCheckInModal(false);
            queryClient.invalidateQueries({ queryKey: ['session', 'status'] });
          }}
        />
      )}
    </div>
  );
}
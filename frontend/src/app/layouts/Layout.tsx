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

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const queryClient = useQueryClient();

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Fetch today's session status
  const { data: sessionStatus } = useQuery({
    queryKey: ['session', 'status'],
    queryFn: () => sessionService.getStatus(),
    refetchInterval: 60_000,
  });

  // Show check-in modal if no attendance yet today
  useEffect(() => {
    if (sessionStatus && !sessionStatus.has_attendance) {
      setShowCheckInModal(true);
    }
    // Hide modal if they already checked in
    if (sessionStatus?.has_attendance) {
      setShowCheckInModal(false);
    }
  }, [sessionStatus]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile Menu Drawer */}
      <MobileMenuDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main column */}
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

      {/* Check-in modal */}
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
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { cn } from '@/lib/utils';

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist collapse state
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Mobile Menu Drawer */}
      <MobileMenuDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main column - handles its own scroll */}
      <div
        className={cn(
          'flex-1 min-w-0 flex flex-col transition-[margin] duration-300 ease-in-out',
          sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[240px]'
        )}
      >
        {/* Sticky TopBar */}
        <TopBar onMenuClick={() => setDrawerOpen(true)} />

        {/* Scrollable content area — scrolls UNDER the topbar */}
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 lg:p-6 pb-20 lg:pb-6 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <MobileBottomNav onMoreClick={() => setDrawerOpen(true)} />
      </div>
    </div>
  );
}
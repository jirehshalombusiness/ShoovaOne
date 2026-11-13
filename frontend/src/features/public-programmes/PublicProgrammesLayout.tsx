import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-[#eaf5ef] text-[#176b4d]'
      : 'text-[#68766f] hover:bg-[#f3f6f4]'
  }`;

export function PublicProgrammesLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="public-programmes-page min-h-screen bg-[#f7f8f6] text-[#18392c]">
      <header className="sticky top-0 z-20 border-b border-[#e7ece8] bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/apply"
            className="flex items-center gap-3 text-left"
            aria-label="Shoova Programs home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#176b4d] text-lg font-bold text-white">
              S
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold tracking-tight">
                Shoova
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.17em] text-[#7b8982]">
                Programs
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            <NavLink to="/apply" end className={navClass}>
              Explore
            </NavLink>
            <NavLink to="/apply/submissions" className={navClass}>
              Recent submissions
            </NavLink>
            <Link
              to="/login"
              className="ml-2 rounded-full border border-[#dfe6e1] px-4 py-2 text-sm font-semibold text-[#176b4d] transition hover:bg-[#f2f7f3]"
            >
              Staff sign in
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:hidden">
            <NavLink to="/apply/submissions" className="rounded-full bg-[#eaf5ef] px-3 py-2 text-xs font-semibold text-[#176b4d]">
              Recent
            </NavLink>
            <Link
              to="/login"
              className="rounded-full px-3 py-2 text-xs font-semibold text-[#176b4d]"
            >
              Staff
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-7 sm:px-8 sm:pt-10">
        {children ?? <Outlet />}
      </main>

      <footer className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-[#e6ebe7] px-5 py-6 text-xs text-[#829087] sm:flex-row sm:px-8 safe-bottom">
        <span>© {new Date().getFullYear()} Shoova Initiative</span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={14} /> A place to learn, connect, and grow
        </span>
      </footer>
    </div>
  );
}

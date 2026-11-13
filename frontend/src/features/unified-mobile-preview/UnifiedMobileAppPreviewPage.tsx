import { isAxiosError } from 'axios';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ERPAppPreviewPage } from '@/features/erp-mobile-preview/ERPAppPreviewPage';
import { PublicProgrammesPage } from '@/features/public-programmes/PublicProgrammesPage';

type AppView = 'programs' | 'staff-sign-in' | 'staff';

export function UnifiedMobileAppPreviewPage() {
  const [view, setView] = useState<AppView>('programs');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const { login, logout, user } = useAuth();

  const handleStaffLogin = async (email: string, password: string) => {
    setLoginError('');
    setLoginLoading(true);

    try {
      const signedInUser = await login(email.trim(), password);
      if (signedInUser.must_change_password) {
        await logout();
        setLoginError(
          'This account needs a password change before opening the staff app.',
        );
        return;
      }

      if (signedInUser.permissions.length === 0) {
        await logout();
        setLoginError(
          'This account does not have staff-app permissions. Contact your administrator.',
        );
        return;
      }

      setView('staff');
    } catch (error: unknown) {
      if (isAxiosError<{ detail?: string }>(error)) {
        setLoginError(
          error.response?.data?.detail ||
            'Unable to sign in. Check your account and try again.',
        );
      } else {
        setLoginError('Unable to sign in. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleStaffSignOut = async () => {
    await logout();
    setView('programs');
  };

  return (
    <>
      <div className={view === 'programs' ? 'relative' : 'hidden'}>
        <button
          type="button"
          onClick={() => setView('staff-sign-in')}
          className="fixed right-4 top-4 z-40 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-[#176b4d] shadow-md"
        >
          Staff sign in
        </button>
        <div className="mx-auto max-w-6xl px-5 py-6">
          <PublicProgrammesPage />
        </div>
      </div>
      <div className={view === 'staff-sign-in' ? '' : 'hidden'}>
        <StaffSignInPreview
          onBack={() => setView('programs')}
          onSubmit={handleStaffLogin}
          error={loginError}
          loading={loginLoading}
        />
      </div>
      <div className={view === 'staff' ? '' : 'hidden'}>
        <ERPAppPreviewPage
          staffName={
            user ? `${user.first_name} ${user.last_name}`.trim() : 'Staff'
          }
          staffTitle={user?.job_title || 'Shoova staff'}
          onExitStaffWorkspace={handleStaffSignOut}
        />
      </div>
    </>
  );
}

function StaffSignInPreview({
  onBack,
  onSubmit,
  error,
  loading,
}: {
  onBack: () => void;
  onSubmit: (email: string, password: string) => Promise<void>;
  error: string;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit(email, password);
  };

  return (
    <main className="erp-mobile-preview-page min-h-screen bg-[#edf1ee] px-4 py-6 text-[#21372e] sm:px-5 sm:py-10">
      <div className="mx-auto max-w-[430px] overflow-hidden rounded-[26px] border border-[#dfe7e1] bg-[#f7f9f7] shadow-[0_16px_60px_rgba(27,54,41,0.12)]">
        <header className="flex items-center justify-between border-b border-[#e7ece8] bg-white px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176b4d] text-sm font-bold text-white">
              S
            </span>
            <span className="text-sm font-bold">Shoova ONE</span>
          </div>
          <span className="rounded-full bg-[#f1f5f2] px-2.5 py-1 text-[10px] font-semibold text-[#6d7b72]">
            Staff access
          </span>
        </header>

        <section className="px-6 py-10 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="mb-9 inline-flex items-center gap-2 text-sm font-semibold text-[#62736a] hover:text-[#176b4d]"
          >
            <ArrowLeft size={16} /> Back to Programs
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e6f1e9] text-[#176b4d]">
            <ShieldCheck size={23} />
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
            Shoova team
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em]">
            Welcome to your workspace.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#748279]">
            Staff sign in to access your work, approvals, attendance, and
            self-service tools.
          </p>

          <div className="mt-7 rounded-2xl border border-[#e2e9e4] bg-white p-4">
            <div className="text-sm font-semibold">Protected staff workspace</div>
            <p className="mt-1.5 text-xs leading-5 text-[#748279]">
              Your credentials and staff permissions are checked by Shoova’s
              authentication service before the staff preview opens.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#52645a]">
                Work email
              </span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[#dfe7e1] bg-white px-4 py-3 text-sm text-[#21372e] outline-none transition placeholder:text-[#9aa69f] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
                placeholder="you@shoova.org"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#52645a]">
                Password
              </span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[#dfe7e1] bg-white px-4 py-3 text-sm text-[#21372e] outline-none transition placeholder:text-[#9aa69f] focus:border-[#176b4d] focus:ring-4 focus:ring-[#176b4d]/10"
                placeholder="Enter your work password"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-[#fff0ed] px-3.5 py-3 text-xs leading-5 text-[#9a4338]"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#0f513a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="mt-3 text-center text-[10px] leading-5 text-[#89958f]">
            Local test uses the isolated demo backend. Never enter production
            credentials here.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-8 w-full border-t border-[#e7ece8] pt-5 text-sm font-semibold text-[#176b4d]"
          >
            I’m an applicant — browse Programs
          </button>
        </section>
      </div>
    </main>
  );
}

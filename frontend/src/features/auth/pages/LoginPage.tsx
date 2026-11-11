import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Clock3,
  Eye,
  EyeOff,
  FolderKanban,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { sessionService } from '@/services/session.service';
import { cn } from '@/lib/utils';

const REMEMBERED_EMAIL_KEY = 'shoova_login_email';

const HIGHLIGHTS = [
  { icon: Users, label: 'People & HR' },
  { icon: FolderKanban, label: 'Projects & delivery' },
  { icon: Clock3, label: 'Time & attendance' },
  { icon: BarChart3, label: 'Impact reporting' },
];

export function LoginPage() {
  const [email, setEmail] = useState(
    () => localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '',
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(
    () => !!localStorage.getItem(REMEMBERED_EMAIL_KEY),
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email.trim(), password);

      if (rememberEmail) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      // Prefetch session status so the check-in modal renders instantly.
      queryClient.prefetchQuery({
        queryKey: ['session', 'status'],
        queryFn: () => sessionService.getStatus(),
        staleTime: 0,
      });

      navigate(user.must_change_password ? '/change-password' : '/dashboard');
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Unable to sign in. Please check your details and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-enter flex min-h-screen items-center justify-center bg-[#f2f5f3] lg:p-5 xl:p-7">
      <div className="relative flex min-h-screen w-full overflow-hidden bg-white shadow-2xl shadow-gray-900/[0.08] lg:min-h-[calc(100vh-2.5rem)] lg:max-w-[1600px] lg:rounded-[28px] xl:min-h-[calc(100vh-3.5rem)]">
        <div className="relative z-10 flex w-full flex-col bg-white lg:w-[46%] xl:w-[44%]">
        <div className="flex items-center justify-between px-6 py-5 sm:px-8 lg:px-10 xl:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <span className="text-base font-bold leading-none text-white">
                S
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-gray-900">
                SHOOVA ONE
              </div>
              <div className="text-[10px] font-medium tracking-wide text-gray-500">
                Management &amp; Impact Platform
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-4 sm:px-8 lg:px-10 xl:px-12">
          <div className="login-content-enter w-full max-w-[400px]">
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                <span className="login-pulse h-1.5 w-1.5 rounded-full bg-primary" />
                Secure team access
              </span>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-gray-900 sm:text-[2.1rem]">
                Welcome back
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Sign in with your work account to pick up where you left off.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold tracking-wide text-gray-700"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400 transition-colors" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder-gray-400 transition duration-200 focus:border-primary/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="you@shoova.org"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold tracking-wide text-gray-700"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-xs font-medium text-primary transition-colors hover:text-primary-dark"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-3 pl-11 pr-12 text-sm text-gray-900 placeholder-gray-400 transition duration-200 focus:border-primary/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex w-fit cursor-pointer select-none items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) => setRememberEmail(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                />
                <span className="text-xs text-gray-600">Remember my email</span>
              </label>

              {error && (
                <div
                  role="alert"
                  className="animate-fade-in flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-xs leading-relaxed text-red-700">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white',
                  'rounded-xl shadow-lg shadow-primary/20 transition duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/20 active:translate-y-0',
                  'focus:outline-none focus:ring-4 focus:ring-primary/20',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary/70" />
              <p className="text-[11px] leading-[1.65] text-gray-500">
                Access is limited to authorised staff. Don&apos;t have an
                account? Contact your system administrator or HR team.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-5 sm:px-8 lg:px-10 xl:px-12">
          <p className="text-[10px] text-gray-400">
            © {new Date().getFullYear()} Shoova Initiative. All rights
            reserved.
          </p>
          <p className="text-[10px] text-gray-400">
            Secure workspace · Shoova ONE
          </p>
        </div>
      </div>

      <div className="login-brand-enter relative hidden flex-1 overflow-hidden bg-[#061d16] lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(110% 90% at 100% 0%, rgba(36,125,89,0.72) 0%, rgba(6,29,22,0) 58%), radial-gradient(90% 80% at 0% 100%, rgba(199,154,53,0.16) 0%, rgba(6,29,22,0) 55%)',
          }}
        />
        <div className="login-orb login-orb-one absolute -right-36 top-12 h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="login-orb login-orb-two absolute -bottom-48 -left-36 h-[28rem] w-[28rem] rounded-full bg-amber-300/[0.08] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.23]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage:
              'radial-gradient(100% 90% at 50% 35%, black 10%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(100% 90% at 50% 35%, black 10%, transparent 78%)',
          }}
        />
        <div className="absolute -right-32 top-20 h-[30rem] w-[30rem] rounded-full border border-white/[0.08]" />
        <div className="absolute -right-8 top-44 h-[22rem] w-[22rem] rounded-full border border-white/[0.08]" />
        <div className="login-pulse absolute right-[22%] top-[24%] h-2 w-2 rounded-full bg-[#d7b55c]" />

        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14 2xl:p-16">
          <div className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c79a35]" />
            Built around your mission
          </div>

          <div className="my-12 max-w-xl">
            <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c5e7d8]/70">
              A clearer view of your organisation
            </p>
            <h2 className="max-w-lg text-[2.5rem] font-semibold leading-[1.12] tracking-[-0.04em] text-white xl:text-5xl">
              Bring your people,
              <br />
              projects and purpose
              <br />
              <span className="text-[#91e0bd]">together.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
              The essential work of your organisation, connected in one
              thoughtful workspace — so your teams can focus on the impact
              they came to make.
            </p>

            <div className="mt-9 grid max-w-lg grid-cols-2 gap-3">
              {HIGHLIGHTS.map((highlight, index) => {
                const Icon = highlight.icon;
                return (
                  <div
                    key={highlight.label}
                    className="login-feature-enter flex items-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.055] px-3.5 py-3.5 backdrop-blur-sm transition duration-200 hover:border-white/20 hover:bg-white/[0.09] sm:px-4"
                    style={{ animationDelay: `${180 + index * 90}ms` }}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.08]">
                      <Icon
                        className="h-4 w-4 text-[#91e0bd]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/80">
                      {highlight.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6">
            <span className="flex items-center gap-2 text-[10px] font-medium text-white/50">
              <ShieldCheck className="h-3.5 w-3.5 text-[#91e0bd]" />
              Role-based access
            </span>
            <span className="flex items-center gap-2 text-[10px] font-medium text-white/50">
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Single source of truth
            </span>
            <span className="flex items-center gap-2 text-[10px] font-medium text-white/50">
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Built for institutions
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

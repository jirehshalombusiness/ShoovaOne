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
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Form column ─────────────────────────────────────── */}
      <div className="relative flex w-full flex-col bg-white lg:w-[54%] xl:w-[48%]">
        <div className="flex items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-base leading-none">
                S
              </span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-gray-900 tracking-tight">
                SHOOVA ONE
              </div>
              <div className="text-[10px] text-gray-500 font-medium tracking-wide">
                Management &amp; Impact Platform
              </div>
            </div>
          </div>

          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-10 pt-4 lg:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Sign in
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-gray-500">
                Enter your work credentials to continue to your workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-600"
                >
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 transition-shadow focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
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
                    className="block text-xs font-semibold uppercase tracking-wider text-gray-600"
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
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-11 text-sm text-gray-900 placeholder-gray-400 transition-shadow focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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

              <label className="flex w-fit cursor-pointer items-center gap-2 select-none">
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
                  className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3"
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
                  'shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark',
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

            <div className="mt-8 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              <p className="text-[11px] leading-relaxed text-gray-500">
                Access is limited to authorised staff. Don&apos;t have an
                account? Contact your system administrator or HR team.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-6 py-5 lg:px-10">
          <p className="text-[11px] text-gray-400">
            © {new Date().getFullYear()} Shoova Initiative. All rights
            reserved.
          </p>
          <p className="text-[11px] text-gray-400">
            Secure workspace · Shoova ONE
          </p>
        </div>
      </div>

      {/* ── Brand column ────────────────────────────────────── */}
      <div className="relative hidden flex-1 overflow-hidden bg-[#07231a] lg:flex">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(28,107,79,0.85) 0%, rgba(7,35,26,0) 60%), radial-gradient(90% 80% at 0% 100%, rgba(199,154,53,0.18) 0%, rgba(7,35,26,0) 55%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage:
              'radial-gradient(120% 100% at 50% 0%, black 20%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(120% 100% at 50% 0%, black 20%, transparent 75%)',
          }}
        />
        <div className="absolute -right-24 top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-40 h-48 w-48 rounded-full border border-white/10" />
        <div className="absolute right-16 top-32 h-2 w-2 rounded-full bg-[#c79a35]" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c79a35]" />
            Shoova ONE · Impact Platform
          </div>

          <div className="max-w-lg">
            <h2 className="text-[2.25rem] font-bold leading-[1.15] tracking-tight text-white xl:text-4xl">
              Where your people,
              <br />
              projects and impact
              <br />
              <span className="text-[#7ee0bb]">come together.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/70">
              One connected operating system for the whole organisation —
              from the first hire to measurable, lasting change in the
              communities you serve.
            </p>

            <div className="mt-9 grid grid-cols-2 gap-3">
              {HIGHLIGHTS.map((highlight) => {
                const Icon = highlight.icon;
                return (
                  <div
                    key={highlight.label}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur-sm"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Icon
                        className="h-4 w-4 text-[#8ce5c3]"
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className="text-xs font-medium text-white/90">
                      {highlight.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-6">
            <span className="flex items-center gap-2 text-[11px] font-medium text-white/55">
              <ShieldCheck className="h-3.5 w-3.5 text-[#8ce5c3]" />
              Role-based access
            </span>
            <span className="flex items-center gap-2 text-[11px] font-medium text-white/55">
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Single source of truth
            </span>
            <span className="flex items-center gap-2 text-[11px] font-medium text-white/55">
              <span className="h-1 w-1 rounded-full bg-white/30" />
              Built for institutions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

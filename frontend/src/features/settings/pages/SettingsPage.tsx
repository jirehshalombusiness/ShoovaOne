import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Eye,
  EyeOff,
  KeyRound,
  Keyboard,
  Lock,
  Mail,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  UserCircle2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { cn, formatRoleLabel } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import { useTheme, type ThemePreference } from '@/lib/theme';
import {
  DESKTOP_NOTIFICATIONS_KEY,
  useNotifications,
} from '@/lib/notifications';

type Section =
  | 'account'
  | 'security'
  | 'appearance'
  | 'notifications'
  | 'shortcuts';

const SECTIONS: {
  value: Section;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: 'account', label: 'Account', icon: UserCircle2 },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export function SettingsPage() {
  const [section, setSection] = useState<Section>('account');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account, security and notification preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <nav className="bg-white border border-gray-200 rounded-lg p-1.5 h-fit lg:sticky lg:top-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-1">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setSection(item.value)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors w-full',
                    section === item.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100',
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0">
          {section === 'account' && <AccountSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'shortcuts' && <ShortcutsSection />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ACCOUNT
// ============================================================

function AccountSection() {
  const { user } = useAuth();

  const roles = user?.roles ?? [];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-5 flex items-center gap-4 border-b border-gray-100">
          <Avatar
            firstName={user?.first_name}
            lastName={user?.last_name}
            imageUrl={user?.profile_image_url}
            size="xl"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-sm text-gray-500 truncate">
              {user?.job_title ?? 'Team member'}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {roles.map((role) => (
                <span
                  key={role}
                  className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium"
                >
                  {formatRoleLabel(role)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="Work email" value={user?.email ?? '—'} />
          <InfoField label="Job title" value={user?.job_title ?? '—'} />
          <InfoField
            label="Member since"
            value={
              user?.created_at
                ? format(new Date(user.created_at), 'd MMMM yyyy')
                : '—'
            }
          />
          <InfoField
            label="Last login"
            value={
              user?.last_login_at
                ? formatDistanceToNow(new Date(user.last_login_at), {
                    addSuffix: true,
                  })
                : '—'
            }
          />
        </div>

        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            Your email address is managed by HR. Contact them to change it.
          </p>
          <Link
            to="/me/profile"
            className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit profile
          </Link>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900">
          Access and permissions
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Your access is granted through roles. If you need more, ask a system
          administrator.
        </p>

        <div className="flex flex-wrap gap-1.5 mt-4">
          {(user?.permissions ?? []).slice(0, 18).map((permission) => (
            <span
              key={permission}
              className="px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px] font-medium text-gray-600"
            >
              {permission}
            </span>
          ))}
          {(user?.permissions?.length ?? 0) > 18 && (
            <span className="px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px] font-medium text-gray-500">
              +{(user?.permissions?.length ?? 0) - 18} more
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm text-gray-900 mt-1 break-words">{value}</div>
    </div>
  );
}

// ============================================================
// SECURITY
// ============================================================

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    try {
      setSaving(true);
      await authService.changePassword(currentPassword, newPassword);
      reset();
      toast.success('Password updated');
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          'Unable to change your password. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const inputType = showPasswords ? 'text' : 'password';

  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Password</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Use at least 8 characters. You will stay signed in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPasswords((value) => !value)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
        >
          {showPasswords ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
          {showPasswords ? 'Hide' : 'Show'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-w-lg">
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          type={inputType}
          placeholder="Enter your current password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          type={inputType}
          placeholder="Enter a new password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          type={inputType}
          placeholder="Re-enter the new password"
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <KeyRound className="w-4 h-4" />
          {saving ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          minLength={label.startsWith('New') ? 8 : undefined}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>
    </div>
  );
}

// ============================================================
// APPEARANCE
// ============================================================

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ElementType;
  preview: {
    bg: string;
    bar: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
  };
}[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'Crisp and bright for daytime work.',
    icon: Sun,
    preview: {
      bg: '#f6f7f8',
      bar: '#ffffff',
      surface: '#ffffff',
      text: '#17201c',
      muted: '#b9c2bd',
      accent: '#176b4d',
    },
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Low glare for late sessions.',
    icon: Moon,
    preview: {
      bg: '#0a100e',
      bar: '#101815',
      surface: '#16211c',
      text: '#eef4f1',
      muted: '#4a5a52',
      accent: '#4fbe92',
    },
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follow your device setting.',
    icon: Monitor,
    preview: {
      bg: 'linear-gradient(90deg, #f6f7f8 50%, #0a100e 50%)',
      bar: 'linear-gradient(90deg, #ffffff 50%, #101815 50%)',
      surface: 'linear-gradient(90deg, #ffffff 50%, #16211c 50%)',
      text: '#8b9993',
      muted: '#7b8a83',
      accent: '#2a8a68',
    },
  },
];

function AppearanceSection() {
  const { preference, resolved, setPreference } = useTheme();

  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Theme</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Choose how Shoova ONE looks. Changes apply instantly and are saved
          to this browser.
        </p>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((option) => {
            const active = preference === option.value;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPreference(option.value)}
                aria-pressed={active}
                className={cn(
                  'group relative rounded-lg border p-2.5 text-left transition-colors',
                  active
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                <div
                  className="h-24 rounded-md border border-black/5 overflow-hidden"
                  style={{ background: option.preview.bg }}
                >
                  <div
                    className="h-5 flex items-center gap-1 px-2 border-b border-black/5"
                    style={{ background: option.preview.bar }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: option.preview.accent }}
                    />
                    <span
                      className="h-1 w-8 rounded-full"
                      style={{ background: option.preview.muted }}
                    />
                  </div>
                  <div className="p-2 space-y-1.5">
                    <div
                      className="h-1.5 w-3/4 rounded-full"
                      style={{ background: option.preview.text, opacity: 0.85 }}
                    />
                    <div
                      className="h-1.5 w-1/2 rounded-full"
                      style={{ background: option.preview.muted }}
                    />
                    <div
                      className="h-5 w-full rounded border border-black/5"
                      style={{ background: option.preview.surface }}
                    />
                    <div
                      className="h-1.5 w-2/3 rounded-full"
                      style={{ background: option.preview.muted }}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2 mt-2.5">
                  <Icon
                    className={cn(
                      'w-4 h-4 mt-0.5 flex-shrink-0',
                      active ? 'text-primary' : 'text-gray-400',
                    )}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {option.label}
                    </div>
                    <div className="text-[11px] text-gray-500 leading-snug">
                      {option.description}
                    </div>
                  </div>

                  {active && (
                    <span className="ml-auto h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md bg-gray-50 border border-gray-100 px-3 py-2.5">
          <Monitor className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-gray-500">
            {preference === 'system'
              ? `Following your device — currently ${resolved} mode.`
              : `Currently using ${resolved} mode.`}{' '}
            You can also switch quickly with the sun or moon button in the top
            bar.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// NOTIFICATIONS
// ============================================================

function NotificationsSection() {
  const { unreadCount, markAllAsRead, notifications } = useNotifications();
  const [desktopEnabled, setDesktopEnabled] = useState(
    () =>
      localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY) === 'true' &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted',
  );

  const permission = useMemo(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  }, []);

  const toggleDesktop = async () => {
    if (desktopEnabled) {
      localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'false');
      setDesktopEnabled(false);
      toast.success('Desktop notifications turned off');
      return;
    }

    if (permission === 'unsupported') {
      toast.error('This browser does not support desktop notifications');
      return;
    }

    const result =
      permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

    if (result !== 'granted') {
      toast.error('Notification permission was not granted');
      return;
    }

    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, 'true');
    setDesktopEnabled(true);
    toast.success('Desktop notifications turned on');
  };

  const sendTest = () => {
    if (permission !== 'granted') {
      toast.error('Desktop notifications are not permitted');
      return;
    }
    new Notification('Shoova ONE', {
      body: 'Desktop notifications are working.',
    });
  };

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Notification channels
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Choose how Shoova ONE reaches you outside the app.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          <SettingRow
            icon={BellRing}
            title="In-app notifications"
            description="Meeting invites, approvals and system updates."
            control={
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCheck className="w-3.5 h-3.5" />
                Always on
              </span>
            }
          />

          <SettingRow
            icon={Bell}
            title="Desktop notifications"
            description={
              permission === 'denied'
                ? 'Blocked by your browser. Enable notifications in site settings.'
                : 'Show an alert when a new notification arrives while the tab is in the background.'
            }
            control={
              <button
                type="button"
                onClick={toggleDesktop}
                disabled={permission === 'unsupported'}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
                  desktopEnabled ? 'bg-primary' : 'bg-gray-200',
                )}
                aria-pressed={desktopEnabled}
                aria-label="Toggle desktop notifications"
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    desktopEnabled ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            }
          />

          <SettingRow
            icon={Mail}
            title="Email notifications"
            description="Meeting invites and approval requests delivered to your work email."
            control={
              <span className="px-2 py-1 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Coming soon
              </span>
            }
          />
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-gray-500">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
              : 'No unread notifications'}
            <span className="text-gray-400">
              {' '}
              · {notifications.length} loaded
            </span>
          </div>
          <div className="flex items-center gap-2">
            {desktopEnabled && (
              <button
                type="button"
                onClick={sendTest}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Send test
              </button>
            )}
            <Link
              to="/notifications"
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Open notification center
            </Link>
            <button
              type="button"
              onClick={() => markAllAsRead()}
              disabled={unreadCount === 0}
              className="px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark all read
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <div className="flex-shrink-0 mt-0.5">{control}</div>
    </div>
  );
}

// ============================================================
// SHORTCUTS
// ============================================================

function ShortcutsSection() {
  const shortcuts = [
    { keys: ['Ctrl', 'K'], action: 'Open search and command menu' },
    { keys: ['↑', '↓'], action: 'Move through search results' },
    { keys: ['Enter'], action: 'Open the highlighted result' },
    { keys: ['Esc'], action: 'Close menus and dialogs' },
  ];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">
            Keyboard shortcuts
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Move around Shoova ONE without leaving the keyboard.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.action}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <span className="text-sm text-gray-700">{shortcut.action}</span>
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-[10px] font-mono text-gray-600"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Keyboard className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Search anything
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl</kbd>{' '}
            + <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px] font-mono">K</kbd>{' '}
            to jump to a page, person, project or task. On macOS use ⌘K.
          </p>
        </div>
      </section>
    </div>
  );
}

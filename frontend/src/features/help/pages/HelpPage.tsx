import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock,
  FolderKanban,
  Inbox,
  LifeBuoy,
  Mail,
  Search,
  Settings,
  UserCircle2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHRAccess } from '@/hooks/useHRAccess';

interface Faq {
  question: string;
  answer: string;
  category: string;
  keywords?: string[];
}

const FAQS: Faq[] = [
  {
    question: 'What is on my dashboard?',
    answer:
      'Your dashboard is built around your portfolio. Everyone gets personal focus cards, today’s agenda, their tasks, projects and approvals. If you have HR, finance or audit access, an Organisation pulse section appears below with workforce and activity insights.',
    category: 'Getting started',
    keywords: ['home', 'overview', 'portfolio', 'widgets'],
  },
  {
    question: 'How do I search for a person, project or task?',
    answer:
      'Press Ctrl+K (⌘K on macOS) or click the search box at the top of the screen. Type at least two characters to search across pages, people, projects and tasks you have access to.',
    category: 'Getting started',
    keywords: ['command', 'palette', 'find', 'shortcut'],
  },
  {
    question: 'How do I request time off?',
    answer:
      'Open My HR → Time Off, choose a leave type, pick your dates and submit. Your request is routed to your manager, then HR if needed. You can follow its status from the same page.',
    category: 'Approvals & time off',
    keywords: ['leave', 'holiday', 'vacation', 'absence'],
  },
  {
    question: 'Where do I find approvals assigned to me?',
    answer:
      'Open My HR → Approvals, or click the approvals card on your dashboard. You will see requests waiting for your decision, their due dates and any that are overdue.',
    category: 'Approvals & time off',
    keywords: ['inbox', 'decision', 'pending', 'manager'],
  },
  {
    question: 'How does the approval routing work?',
    answer:
      'Requests start with the direct manager. If a manager is unavailable or the request needs more authority, it moves to HR and then to an executive. Every request has a service-level target, and overdue items are escalated automatically.',
    category: 'Approvals & time off',
    keywords: ['escalation', 'sla', 'workflow', 'hr'],
  },
  {
    question: 'How do I schedule a meeting?',
    answer:
      'Go to Meetings → New Meeting, add attendees and a time. Attendees receive an in-app notification immediately. You can track responses, agenda items and join links from the meeting page.',
    category: 'Meetings',
    keywords: ['calendar', 'invite', 'schedule', 'rsvp'],
  },
  {
    question: 'Why have I not received an email about a meeting?',
    answer:
      'Email delivery for meeting invitations and approvals is being rolled out in the next release. Until then, meeting invitations and reminders appear in the notification bell and on the Notifications page.',
    category: 'Meetings',
    keywords: ['email', 'resend', 'reminder', 'invite'],
  },
  {
    question: 'How do I log or review my hours?',
    answer:
      'Open Timesheets from the sidebar, or use the My week card on your dashboard. Log entries against a project and submit the week for approval when you are done.',
    category: 'Tasks & projects',
    keywords: ['timesheet', 'hours', 'time', 'week'],
  },
  {
    question: 'How do I create or join a project?',
    answer:
      'Open Projects to see projects you belong to. If you have create permission, use Create → Create Project in the top bar. Tasks, milestones, team, documents and activity live inside each project.',
    category: 'Tasks & projects',
    keywords: ['project', 'task', 'milestone', 'team'],
  },
  {
    question: 'How do I change my password?',
    answer:
      'Open Settings → Security, enter your current password and choose a new one of at least 12 characters. You stay signed in after the change.',
    category: 'Account & access',
    keywords: ['password', 'security', 'login'],
  },
  {
    question: 'How do I update my profile details?',
    answer:
      'Open My HR → Profile to update your phone, address, emergency contact and bio. Your work email is managed by HR, so contact them if it needs to change.',
    category: 'Account & access',
    keywords: ['profile', 'email', 'phone', 'contact'],
  },
  {
    question: 'How do I manage notification preferences?',
    answer:
      'Open Settings → Notifications. You can turn desktop alerts on or off, send a test alert and open the notification center. In-app notifications are always on.',
    category: 'Account & access',
    keywords: ['notifications', 'desktop', 'alerts', 'bell'],
  },
  {
    question: 'I cannot see a page I need. What should I do?',
    answer:
      'Pages are shown based on your roles and permissions. If something is missing, ask your system administrator or HR administrator to review your access. You can still use the Org Chart to find the right person.',
    category: 'Troubleshooting',
    keywords: ['permission', 'access', 'missing', '403'],
  },
  {
    question: 'My session was paused. Why?',
    answer:
      'Shoova ONE pauses your attendance session after a period of inactivity and signs you out after a longer period. Sign in again to resume. This protects sensitive HR and finance data.',
    category: 'Troubleshooting',
    keywords: ['idle', 'timeout', 'session', 'sign out'],
  },
];

const CATEGORIES = [
  'All',
  ...Array.from(new Set(FAQS.map((faq) => faq.category))),
];

export function HelpPage() {
  const access = useHRAccess();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

  const quickLinks = useMemo(() => {
    const links: Array<{
      icon: React.ElementType;
      label: string;
      description: string;
      path: string;
      visible?: boolean;
    }> = [
      {
        icon: CalendarDays,
        label: 'My Work',
        description: 'Tasks, meetings and your week',
        path: '/my-work',
      },
      {
        icon: UserCircle2,
        label: 'My HR',
        description: 'Time off, profile and documents',
        path: '/me',
      },
      {
        icon: Clock,
        label: 'Timesheets',
        description: 'Log and submit your hours',
        path: '/timesheets',
        visible: access.has('timesheets.view'),
      },
      {
        icon: FolderKanban,
        label: 'Projects',
        description: 'Your projects and team work',
        path: '/projects',
        visible: access.has('projects.view'),
      },
      {
        icon: Users,
        label: 'Org Chart',
        description: 'See who reports to whom',
        path: '/people/org-chart',
      },
      {
        icon: Inbox,
        label: 'Approvals',
        description: 'Decisions waiting for you',
        path: '/me/approvals',
      },
      {
        icon: Settings,
        label: 'Settings',
        description: 'Account and notification preferences',
        path: '/settings',
      },
      {
        icon: BookOpen,
        label: 'HR Admin',
        description: 'People operations workspace',
        path: '/hr',
        visible: access.canAccessHRAdmin,
      },
    ];

    return links.filter((link) => link.visible !== false).slice(0, 6);
  }, [access]);

  const filteredFaqs = useMemo(() => {
    const search = query.trim().toLowerCase();

    return FAQS.filter((faq) => {
      if (category !== 'All' && faq.category !== category) return false;
      if (!search) return true;

      return (
        faq.question.toLowerCase().includes(search) ||
        faq.answer.toLowerCase().includes(search) ||
        faq.category.toLowerCase().includes(search) ||
        (faq.keywords ?? []).some((keyword) => keyword.includes(search))
      );
    });
  }, [query, category]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary to-primary-dark px-6 py-8 text-white">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Help & Support
          </p>
          <h1 className="text-2xl font-bold mt-1">
            How can we help you today?
          </h1>
          <p className="text-sm text-white/70 mt-2">
            Search the handbook or jump straight to the part of Shoova ONE you
            need.
          </p>

          <div className="relative mt-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help articles..."
              className="w-full pl-10 pr-4 py-2.5 bg-card text-text rounded-lg text-sm placeholder:text-muted border border-border focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-sm font-semibold text-text mb-3">
          Quick links
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="group bg-card border border-border rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon
                      className="w-4 h-4 text-muted"
                      strokeWidth={1.75}
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-sm font-semibold text-text mt-3">
                  {link.label}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {link.description}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-text">
              Frequently asked questions
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {filteredFaqs.length} article
              {filteredFaqs.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
          {CATEGORIES.map((option) => (
            <button
              key={option}
              onClick={() => setCategory(option)}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                category === option
                  ? 'bg-primary text-white'
                  : 'text-muted hover:bg-gray-100 hover:text-text',
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="py-14 text-center px-6">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">
              No articles match “{query}”
            </p>
            <p className="text-xs text-muted mt-1">
              Try a different word, or contact support below.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredFaqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={faq.question}>
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-text">
                          {faq.question}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[9px] font-semibold uppercase tracking-wider text-muted">
                          {faq.category}
                        </span>
                      </div>
                      {isOpen && (
                        <p className="text-xs text-gray-600 leading-relaxed mt-2">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support */}
      <section className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <LifeBuoy className="w-5 h-5 text-primary" strokeWidth={1.75} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-text">
              Still need help?
            </h2>
            <p className="text-xs text-muted mt-1 max-w-2xl">
              Your HR administrator can help with people records, leave and
              approvals. Your system administrator can help with access,
              passwords and technical issues.
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {supportEmail ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email support
                </a>
              ) : (
                <Link
                  to="/people/org-chart"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  Find your administrator
                </Link>
              )}

              <Link
                to="/me"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-md text-xs font-medium text-text hover:bg-gray-50 transition-colors"
              >
                <UserCircle2 className="w-3.5 h-3.5" />
                Open My HR
              </Link>

              <Link
                to="/settings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-md text-xs font-medium text-text hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

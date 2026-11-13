import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  FileText,
  Home,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Receipt,
  Wallet,
} from 'lucide-react';

type Tab = 'home' | 'work' | 'approvals' | 'inbox' | 'more';

const initialTasks = [
  {
    id: 'partner-brief',
    title: 'Review partner briefing',
    context: 'Community Impact · Due today',
    priority: 'Due today',
  },
  {
    id: 'cohort-plan',
    title: 'Update cohort session plan',
    context: 'Youth Enterprise Lab · Due tomorrow',
    priority: 'Tomorrow',
  },
  {
    id: 'expense-report',
    title: 'Submit travel expense report',
    context: 'Finance · Due Friday',
    priority: 'This week',
  },
];

const initialApprovals = [
  {
    id: 'leave-request',
    title: 'Leave request',
    person: 'Nana A. · 2 days',
    date: 'Submitted 18 min ago',
  },
  {
    id: 'expense-claim',
    title: 'Expense claim',
    person: 'Kojo M. · GHS 420',
    date: 'Submitted yesterday',
  },
];

const primaryTabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

export function ERPAppPreviewPage({
  onExitStaffWorkspace,
  staffName = 'Ama Asante',
  staffTitle = 'Program Coordinator',
}: {
  onExitStaffWorkspace?: () => void;
  staffName?: string;
  staffTitle?: string;
} = {}) {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [checkedIn, setCheckedIn] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, 'Approved' | 'Returned'>>({});
  const [readNotices, setReadNotices] = useState(false);

  const pendingApprovals = initialApprovals.filter(
    (approval) => !decisions[approval.id],
  );
  const firstName = staffName.split(/\s+/)[0] || 'Staff';
  const initials = staffName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const greeting =
    new Date().getHours() < 12
      ? 'Good morning'
      : new Date().getHours() < 17
        ? 'Good afternoon'
        : 'Good evening';

  return (
    <div className="erp-mobile-preview-page min-h-screen bg-[#edf1ee] text-[#21372e] sm:px-5 sm:py-7">
      <div className="relative mx-auto flex min-h-screen max-w-[430px] flex-col overflow-hidden bg-[#f7f9f7] shadow-[0_16px_60px_rgba(27,54,41,0.12)] sm:min-h-[820px] sm:rounded-[30px] sm:border sm:border-[#dfe7e1]">
        <header className="border-b border-[#e7ece8] bg-white px-5 pb-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#176b4d] text-sm font-bold text-white">
                S
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold tracking-tight">
                  Shoova ONE
                </span>
                <span className="mt-0.5 block text-[10px] font-medium text-[#78877e]">
                  STAFF APP · LOCAL PREVIEW
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onExitStaffWorkspace && (
                <button
                  type="button"
                  onClick={onExitStaffWorkspace}
                  className="flex h-10 items-center gap-1 rounded-full px-2 text-xs font-semibold text-[#176b4d] transition hover:bg-[#f2f7f3]"
                  aria-label="Sign out and return to Programs"
                >
                  <ArrowLeft size={15} />
                  Sign out
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab('inbox')}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e7ece8] bg-white text-[#52645a] transition hover:bg-[#f4f7f5]"
                aria-label="Open inbox"
              >
                <Bell size={18} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-[#d49e36]" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pb-28 pt-6">
          {activeTab === 'home' && (
            <>
              <section className="mb-5">
                <p className="text-sm font-medium text-[#748279]">
                  {new Date().toLocaleDateString('en-GH', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div>
                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em]">
                      {greeting}, {firstName}
                    </h1>
                    <p className="mt-1 text-sm text-[#748279]">
                      Here’s what’s happening today.
                    </p>
                  </div>
                  <div className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f1eb] text-sm font-bold text-[#176b4d]">
                    {initials}
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-[22px] bg-[#176b4d] p-5 text-white shadow-[0_12px_28px_rgba(23,107,77,0.16)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-[#d3e7dc]">
                      <Clock3 size={15} />
                      Attendance
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">
                      {checkedIn ? 'You’re checked in' : 'Ready to start your day?'}
                    </h2>
                    <p className="mt-1 text-xs text-[#d3e7dc]">
                      {checkedIn
                        ? `Started at ${new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Check in when you arrive at work.'}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                    {checkedIn ? <Check size={19} /> : <MapPin size={19} />}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckedIn((current) => !current)}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#176b4d] transition hover:bg-[#edf5f0]"
                >
                  {checkedIn ? 'Check out' : 'Check in'}
                  <ArrowRight size={16} />
                </button>
                <p className="mt-2 text-center text-[10px] text-[#d3e7dc]">
                  Demo action · no location or attendance is recorded
                </p>
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Quick actions</h2>
                  <span className="text-[11px] text-[#87938c]">
                    Your self-service
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Time off', icon: CalendarDays },
                    { label: 'Payslips', icon: Wallet },
                    { label: 'Expenses', icon: Receipt },
                    { label: 'Documents', icon: FileText },
                  ].map((action) => (
                    <button
                      type="button"
                      key={action.label}
                      onClick={() => setActiveTab('more')}
                      className="flex min-h-[86px] flex-col items-center justify-center gap-2 rounded-2xl border border-[#e6ece8] bg-white px-1.5 py-3 text-center transition hover:border-[#c8d8ce] hover:bg-[#fbfcfb]"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf5f0] text-[#176b4d]">
                        <action.icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="text-[10px] font-semibold text-[#56675d]">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Today at a glance</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('work')}
                    className="text-xs font-semibold text-[#176b4d]"
                  >
                    View work
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard
                    label="My open tasks"
                    value={`${initialTasks.length - completedTasks.length}`}
                    note="1 due today"
                    icon={CheckSquare}
                    onClick={() => setActiveTab('work')}
                  />
                  <SummaryCard
                    label="Needs approval"
                    value={`${pendingApprovals.length}`}
                    note="Team requests"
                    icon={CheckCircle2}
                    onClick={() => setActiveTab('approvals')}
                  />
                </div>
              </section>

              <section className="mt-7">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Coming up</h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('work')}
                    className="flex items-center gap-1 text-xs font-semibold text-[#176b4d]"
                  >
                    Calendar <ChevronRight size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-[#e6ece8] bg-white p-4">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[#f4f0e4] text-[#987626]">
                    <span className="text-[9px] font-bold uppercase">Today</span>
                    <span className="text-sm font-bold">10:30</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      Program team check-in
                    </p>
                    <p className="mt-1 text-xs text-[#829087]">
                      Meeting · 30 minutes
                    </p>
                  </div>
                  <ChevronRight size={17} className="text-[#9aa69f]" />
                </div>
              </section>
            </>
          )}

          {activeTab === 'work' && (
            <section>
              <PageHeading
                eyebrow="Your day, in focus"
                title="My work"
                description="Tasks and follow-ups assigned to you."
              />
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-[#e6ece8] bg-white p-4">
                <div>
                  <p className="text-xs text-[#7c8981]">OPEN TASKS</p>
                  <p className="mt-1 text-xl font-semibold">
                    {initialTasks.length - completedTasks.length}
                  </p>
                </div>
                <span className="rounded-full bg-[#fff4dc] px-3 py-1.5 text-xs font-semibold text-[#89671c]">
                  1 due today
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {initialTasks.map((task) => {
                  const done = completedTasks.includes(task.id);
                  return (
                    <article
                      key={task.id}
                      className="rounded-2xl border border-[#e6ece8] bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          aria-label={done ? 'Mark task incomplete' : 'Mark task complete'}
                          onClick={() =>
                            setCompletedTasks((current) =>
                              done
                                ? current.filter((id) => id !== task.id)
                                : [...current, task.id],
                            )
                          }
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            done
                              ? 'border-[#176b4d] bg-[#176b4d] text-white'
                              : 'border-[#cbd6cf] text-transparent'
                          }`}
                        >
                          <Check size={13} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h2
                            className={`text-sm font-semibold ${
                              done ? 'text-[#87938c] line-through' : 'text-[#263a30]'
                            }`}
                          >
                            {task.title}
                          </h2>
                          <p className="mt-1.5 text-xs text-[#829087]">
                            {task.context}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#f3f6f4] px-2.5 py-1 text-[10px] font-medium text-[#748279]">
                          {done ? 'Done' : task.priority}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === 'approvals' && (
            <section>
              <PageHeading
                eyebrow="For your review"
                title="Approvals"
                description={`${pendingApprovals.length} ${
                  pendingApprovals.length === 1 ? 'request is' : 'requests are'
                } waiting for your decision.`}
              />
              {pendingApprovals.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {pendingApprovals.map((approval) => (
                    <article
                      key={approval.id}
                      className="rounded-2xl border border-[#e6ece8] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-semibold">
                            {approval.title}
                          </h2>
                          <p className="mt-1 text-sm text-[#63736a]">
                            {approval.person}
                          </p>
                          <p className="mt-1 text-[11px] text-[#8b9790]">
                            {approval.date}
                          </p>
                        </div>
                        <span className="rounded-full bg-[#fff5dd] px-2.5 py-1 text-[10px] font-semibold text-[#89671c]">
                          Pending
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((current) => ({
                              ...current,
                              [approval.id]: 'Returned',
                            }))
                          }
                          className="rounded-xl border border-[#dfe7e1] px-3 py-2.5 text-xs font-semibold text-[#5e6f65] hover:bg-[#f7f9f7]"
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDecisions((current) => ({
                              ...current,
                              [approval.id]: 'Approved',
                            }))
                          }
                          className="rounded-xl bg-[#176b4d] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#0f513a]"
                        >
                          Approve
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="You’re all caught up"
                  description="New requests that need your review will show up here."
                />
              )}
            </section>
          )}

          {activeTab === 'inbox' && (
            <section>
              <PageHeading
                eyebrow="Updates for you"
                title="Inbox"
                description="The latest activity across your work."
              />
              <button
                type="button"
                onClick={() => setReadNotices(true)}
                className="mt-5 text-xs font-semibold text-[#176b4d]"
              >
                Mark all as read
              </button>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#e6ece8] bg-white">
                {[
                  {
                    title: 'A new task was assigned to you',
                    detail: 'Review partner briefing · Projects',
                    time: '10 min ago',
                  },
                  {
                    title: 'Your leave request was approved',
                    detail: 'Your request for 21–22 Nov is confirmed.',
                    time: 'Yesterday',
                  },
                  {
                    title: 'Program team check-in',
                    detail: 'Reminder · Today at 10:30',
                    time: 'Yesterday',
                  },
                ].map((notice, index) => (
                  <article
                    key={notice.title}
                    className={`flex gap-3 p-4 ${
                      index > 0 ? 'border-t border-[#edf0ee]' : ''
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        readNotices ? 'bg-[#dce4de]' : 'bg-[#d49e36]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{notice.title}</p>
                      <p className="mt-1 text-xs leading-5 text-[#748279]">
                        {notice.detail}
                      </p>
                      <p className="mt-2 text-[10px] text-[#9aa59f]">
                        {notice.time}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'more' && (
            <section>
              <PageHeading
                eyebrow="Shoova ONE"
                title="More"
                description="Your profile and the tools available to you."
              />
              <div className="mt-5 rounded-2xl border border-[#e6ece8] bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f1eb] text-sm font-bold text-[#176b4d]">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{staffName}</p>
                    <p className="mt-0.5 text-xs text-[#829087]">
                      {staffTitle}
                    </p>
                  </div>
                  <ChevronRight size={17} className="ml-auto text-[#9aa69f]" />
                </div>
              </div>
              <div className="mt-5 space-y-5">
                <MoreGroup
                  title="My self-service"
                  items={['My profile', 'Time off', 'Payslips', 'Documents']}
                />
                <MoreGroup
                  title="Work"
                  items={[
                    'Projects',
                    'Program operations',
                    'Meetings',
                    'Timesheets',
                    'Help & support',
                  ]}
                />
              </div>
              <p className="mt-6 rounded-xl bg-[#eef4ef] p-3.5 text-xs leading-5 text-[#617269]">
                Sensitive tools such as payroll and HR administration should
                only appear for users with the right role and permissions.
              </p>
            </section>
          )}
        </main>

        <nav
          aria-label="Staff app"
          className="fixed bottom-0 left-1/2 z-20 flex h-[72px] w-full max-w-[430px] -translate-x-1/2 items-center justify-around border-t border-[#e7ece8] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count =
              tab.id === 'approvals' ? pendingApprovals.length : 0;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-[60px] flex-col items-center gap-1 rounded-xl px-2 py-2 transition ${
                  active ? 'text-[#176b4d]' : 'text-[#8a968e]'
                }`}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                  {count > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d49e36] px-1 text-[9px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="mx-auto max-w-[430px] px-4 py-2 text-center text-[10px] text-[#7c8981] sm:px-0">
        Local preview · Demo data only · No live actions or sensitive data
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof CheckSquare;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-[#e6ece8] bg-white p-4 text-left transition hover:border-[#c8d8ce]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#748279]">{label}</span>
        <Icon size={16} className="text-[#176b4d]" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className="text-[10px] text-[#87938c]">{note}</span>
      </div>
    </button>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a17d2d]">
        {eyebrow}
      </p>
      <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-0.04em]">
        {title}
      </h1>
      <p className="mt-1 text-sm text-[#748279]">{description}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CheckCircle2;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[#d6dfd9] bg-white px-5 py-10 text-center">
      <Icon size={25} className="mx-auto text-[#176b4d]" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-[#748279]">
        {description}
      </p>
    </div>
  );
}

function MoreGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold text-[#78867e]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#e6ece8] bg-white">
        {items.map((item, index) => (
          <button
            type="button"
            key={item}
            className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-[#40554a] hover:bg-[#f8faf8] ${
              index > 0 ? 'border-t border-[#edf0ee]' : ''
            }`}
          >
            {item}
            <ChevronRight size={16} className="text-[#a0aaa4]" />
          </button>
        ))}
      </div>
    </section>
  );
}

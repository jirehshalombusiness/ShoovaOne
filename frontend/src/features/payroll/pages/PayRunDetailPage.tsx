import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Landmark,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  getErrorMessage,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import type { PayRunDetail } from '../payroll.types';

const FINAL_STATUSES = new Set([
  'finalized',
  'disbursing',
  'paid',
  'closed',
  'reversed',
]);

type Tab = 'employees' | 'approvals' | 'gl' | 'remittances';

export function PayRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const access = useHRAccess();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('employees');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const runQuery = useQuery({
    queryKey: ['payroll', 'run', runId],
    queryFn: () => payrollService.getRun(runId as string),
    enabled: Boolean(runId),
  });

  const run = runQuery.data;
  const isFinal = run ? FINAL_STATUSES.has(run.status) : false;

  const glQuery = useQuery({
    queryKey: ['payroll', 'run', runId, 'gl'],
    queryFn: () => payrollService.getRunGLEntries(runId as string),
    enabled: Boolean(runId) && isFinal,
  });

  const remittanceQuery = useQuery({
    queryKey: ['payroll', 'run', runId, 'remittances'],
    queryFn: () => payrollService.getRunRemittances(runId as string),
    enabled: Boolean(runId) && isFinal,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['payroll', 'run', runId] });
    await queryClient.invalidateQueries({ queryKey: ['payroll', 'runs'] });
    await queryClient.invalidateQueries({ queryKey: ['payroll', 'overview'] });
  };

  const calculate = useMutation({
    mutationFn: () => payrollService.calculateRun(runId as string),
    onSuccess: () => {
      toast.success('Payroll calculated');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Calculation failed')),
  });

  const submit = useMutation({
    mutationFn: (note?: string) => payrollService.submitRun(runId as string, note),
    onSuccess: () => {
      toast.success('Submitted to Finance');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not submit the run')),
  });

  const review = useMutation({
    mutationFn: ({ decision, note }: { decision: 'approved' | 'returned'; note?: string }) =>
      payrollService.reviewRun(runId as string, decision, note),
    onSuccess: (_, variables) => {
      toast.success(
        variables.decision === 'approved'
          ? 'Finance review approved'
          : 'Run returned to HR',
      );
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Review failed')),
  });

  const approve = useMutation({
    mutationFn: (note?: string) => payrollService.approveRun(runId as string, note),
    onSuccess: () => {
      toast.success('Final approval recorded');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Approval failed')),
  });

  const finalize = useMutation({
    mutationFn: () => payrollService.finalizeRun(runId as string),
    onSuccess: () => {
      toast.success('Payroll finalized and payslips issued');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Finalization failed')),
  });

  if (runQuery.isLoading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading pay run...
      </div>
    );
  }

  if (runQuery.isError || !run) {
    return (
      <div className="space-y-4">
        <Link
          to="/payroll/runs"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pay runs
        </Link>
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load this pay run</p>
            <p className="mt-1">{getErrorMessage(runQuery.error)}</p>
          </div>
        </div>
      </div>
    );
  }

  const canPrepare = access.has(['payroll.prepare', 'payroll.review_hr']);
  const canSubmitToFinance = access.has('payroll.review_hr');
  const canReviewFinance = access.has('payroll.review_finance');
  const canApprove = access.has('payroll.approve');

  const toggleItem = (id: string) => {
    setExpandedItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const notePrompt = (title: string) => {
    const value = window.prompt(title, '');
    if (value === null) return null;
    return value.trim() || undefined;
  };

  const actions: React.ReactNode[] = [];

  if (['draft', 'calculated'].includes(run.status) && canPrepare) {
    actions.push(
      <button
        key="calculate"
        type="button"
        onClick={() => calculate.mutate()}
        disabled={calculate.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
      >
        <RotateCcw className="h-4 w-4" />
        {calculate.isPending ? 'Calculating…' : run.status === 'draft' ? 'Calculate payroll' : 'Recalculate'}
      </button>,
    );
  }

  if (run.status === 'calculated' && canSubmitToFinance) {
    actions.push(
      <button
        key="submit"
        type="button"
        onClick={() => {
          if (run.employee_count === 0) {
            toast.error('Calculate the run before submitting it');
            return;
          }
          const note = notePrompt('Note for Finance (optional)');
          if (note === null) return;
          submit.mutate(note);
        }}
        disabled={submit.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {submit.isPending ? 'Submitting…' : 'Submit to Finance'}
      </button>,
    );
  }

  if (run.status === 'hr_approved' && canReviewFinance) {
    actions.push(
      <button
        key="return"
        type="button"
        onClick={() => {
          const note = notePrompt('Reason for returning to HR');
          if (note === null) return;
          review.mutate({ decision: 'returned', note });
        }}
        disabled={review.isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-60"
      >
        <XCircle className="h-4 w-4" />
        Return to HR
      </button>,
      <button
        key="finance-approve"
        type="button"
        onClick={() => {
          const note = notePrompt('Finance review note (optional)');
          if (note === null) return;
          review.mutate({ decision: 'approved', note });
        }}
        disabled={review.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
      >
        <CheckCircle2 className="h-4 w-4" />
        Approve Finance review
      </button>,
    );
  }

  if (run.status === 'finance_approved' && canApprove) {
    actions.push(
      <button
        key="final-approve"
        type="button"
        onClick={() => {
          const note = notePrompt('Final approval note (optional)');
          if (note === null) return;
          approve.mutate(note);
        }}
        disabled={approve.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" />
        Give final approval
      </button>,
    );
  }

  if (run.status === 'approved' && access.has(['payroll.review_finance', 'payroll.approve'])) {
    actions.push(
      <button
        key="finalize"
        type="button"
        onClick={() => {
          if (
            !window.confirm(
              'Finalize this run? Payslips will be issued, timesheets locked and the payroll locked against further calculation.',
            )
          ) {
            return;
          }
          finalize.mutate();
        }}
        disabled={finalize.isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        {finalize.isPending ? 'Finalizing…' : 'Finalize & issue payslips'}
      </button>,
    );
  }

  if (isFinal && access.has(['payroll.disburse', 'payroll.review_finance', 'payroll.approve'])) {
    actions.push(
      <button
        key="disburse"
        type="button"
        onClick={() => navigate('/payroll/disbursements')}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
      >
        <Banknote className="h-4 w-4" />
        Go to disbursements
      </button>,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/payroll/runs"
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pay runs
        </Link>
      </div>

      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-500">
              {run.period_name ?? 'Pay run'}
            </p>
            <PayrollStatusBadge status={run.status} />
            {run.exception_count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {run.exception_count} exception(s)
              </span>
            )}
          </div>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            {run.run_number ?? 'Draft pay run'}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {run.pay_group_name ?? 'Pay group'} · {titleCase(run.run_type)} ·{' '}
            {formatNumber(run.employee_count)} employees · {run.currency}
          </p>
        </div>

        {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Gross pay" value={formatMoney(run.total_gross, run.currency)} />
        <Stat
          label="Employee deductions"
          value={formatMoney(run.total_employee_deductions, run.currency)}
        />
        <Stat
          label="Employer contributions"
          value={formatMoney(run.total_employer_contributions, run.currency)}
        />
        <Stat
          label="Net pay"
          value={formatMoney(run.total_net, run.currency)}
          emphasis
        />
        <Stat
          label="Employer cost"
          value={formatMoney(run.total_employer_cost, run.currency)}
        />
      </section>

      {run.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">Notes: </span>
          {run.notes}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 pt-3">
          <TabButton active={tab === 'employees'} onClick={() => setTab('employees')}>
            <Users className="h-4 w-4" />
            Employees ({run.items.length})
          </TabButton>
          <TabButton active={tab === 'approvals'} onClick={() => setTab('approvals')}>
            <ShieldCheck className="h-4 w-4" />
            Approvals ({run.approvals.length})
          </TabButton>
          <TabButton active={tab === 'gl'} onClick={() => setTab('gl')}>
            <Landmark className="h-4 w-4" />
            General ledger
          </TabButton>
          <TabButton active={tab === 'remittances'} onClick={() => setTab('remittances')}>
            <FileText className="h-4 w-4" />
            Remittances
          </TabButton>
        </div>

        {tab === 'employees' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Employee</Th>
                  <Th>Status</Th>
                  <Th align="right">Hours</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Deductions</Th>
                  <Th align="right">Net</Th>
                  <Th align="right">Employer cost</Th>
                  <Th align="right">Breakdown</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.items.map((item) => {
                  const expanded = expandedItems.has(item.id);
                  return (
                    <Fragment key={item.id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.person_name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.employee_number ?? 'No employee number'} ·{' '}
                            {item.department ?? 'Unassigned'}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <PayrollStatusBadge status={item.status} />
                          {item.exception_summary && (
                            <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-amber-700">
                              {item.exception_summary}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-slate-700">
                          <p>{formatNumber(item.regular_hours, 2)} regular</p>
                          <p className="text-xs text-slate-500">
                            {formatNumber(item.overtime_hours, 2)} overtime
                          </p>
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-slate-700">
                          {formatMoney(item.gross_pay, item.currency)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-slate-700">
                          {formatMoney(item.total_employee_deductions, item.currency)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold text-slate-900">
                          {formatMoney(item.net_pay, item.currency)}
                        </td>
                        <td className="px-5 py-4 text-right text-sm text-slate-700">
                          {formatMoney(item.employer_cost, item.currency)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {expanded ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                            Lines
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="px-5 py-4">
                            {item.lines.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                No calculated lines for this employee.
                              </p>
                            ) : (
                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full divide-y divide-slate-200">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <Th>Component</Th>
                                      <Th>Category</Th>
                                      <Th align="right">Quantity</Th>
                                      <Th align="right">Rate</Th>
                                      <Th align="right">Amount</Th>
                                      <Th>Notes</Th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {item.lines.map((line) => (
                                      <tr key={line.id}>
                                        <td className="px-4 py-2.5 text-xs font-medium text-slate-800">
                                          {line.name}
                                          <span className="ml-1 text-slate-400">
                                            ({line.code})
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-600">
                                          {titleCase(line.category)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-slate-600">
                                          {line.quantity ? formatNumber(line.quantity, 2) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-slate-600">
                                          {line.rate ? formatNumber(line.rate, 4) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-900">
                                          {formatMoney(line.amount, item.currency)}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-500">
                                          {line.notes ?? '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'approvals' && (
          <div className="p-5">
            {run.approvals.length === 0 ? (
              <EmptyPanel
                icon={Clock3}
                title="No approvals yet"
                text="Calculate the run and submit it to Finance to start the approval trail."
              />
            ) : (
              <ol className="space-y-4">
                {run.approvals.map((approval) => (
                  <li
                    key={approval.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {titleCase(approval.stage)} · {titleCase(approval.decision)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(approval.decided_at)}
                      </p>
                      {approval.note && (
                        <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                          {approval.note}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {tab === 'gl' && (
          <div>
            {!isFinal ? (
              <EmptyPanel
                icon={Lock}
                title="General ledger is posted on finalization"
                text="Finalize the run to generate balanced payroll journal entries."
              />
            ) : glQuery.isLoading ? (
              <LoadingPanel />
            ) : (glQuery.data ?? []).length === 0 ? (
              <EmptyPanel
                icon={Landmark}
                title="No GL entries"
                text="No journal entries were generated for this run."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Date</Th>
                      <Th>Account</Th>
                      <Th>Description</Th>
                      <Th>Cost centre</Th>
                      <Th align="right">Debit</Th>
                      <Th align="right">Credit</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(glQuery.data ?? []).map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {formatDate(entry.entry_date)}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {entry.account_code}
                          <span className="ml-1 font-normal text-slate-500">
                            {entry.account_name}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {entry.description ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {entry.cost_center ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {formatMoney(entry.debit, run.currency)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {formatMoney(entry.credit, run.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'remittances' && (
          <div>
            {!isFinal ? (
              <EmptyPanel
                icon={FileText}
                title="Remittances are created on finalization"
                text="Statutory employee and employer amounts will be grouped by scheme for payment."
              />
            ) : remittanceQuery.isLoading ? (
              <LoadingPanel />
            ) : (remittanceQuery.data ?? []).length === 0 ? (
              <EmptyPanel
                icon={FileText}
                title="No statutory remittances"
                text="This run has no statutory schemes configured."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Scheme</Th>
                      <Th>Status</Th>
                      <Th>Due date</Th>
                      <Th align="right">Employee</Th>
                      <Th align="right">Employer</Th>
                      <Th align="right">Total</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(remittanceQuery.data ?? []).map((remittance) => (
                      <tr key={remittance.id}>
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {remittance.scheme_name}
                        </td>
                        <td className="px-5 py-3">
                          <PayrollStatusBadge status={remittance.status} />
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {formatDate(remittance.due_date)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {formatMoney(remittance.employee_amount, run.currency)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {formatMoney(remittance.employer_amount, run.currency)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm font-semibold text-slate-900">
                          {formatMoney(remittance.total_amount, run.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <WorkflowFooter run={run} />
    </div>
  );
}

function WorkflowFooter({ run }: { run: PayRunDetail }) {
  const steps = [
    { label: 'Draft', status: 'draft' },
    { label: 'Calculated', status: 'calculated' },
    { label: 'HR submitted', status: 'hr_approved' },
    { label: 'Finance approved', status: 'finance_approved' },
    { label: 'Final approval', status: 'approved' },
    { label: 'Finalized', status: 'finalized' },
  ];

  const order = steps.map((step) => step.status);
  const currentIndex = order.indexOf(run.status);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">Run progress</h2>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium">
        {steps.map((step, index) => {
          const done =
            (currentIndex >= 0 && index <= currentIndex) ||
            ['disbursing', 'paid'].includes(run.status);
          const active = order[currentIndex] === step.status;

          return (
            <span key={step.status} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {done && !active && <CheckCircle2 className="h-3.5 w-3.5" />}
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              )}
            </span>
          );
        })}

        {['finalized', 'disbursing', 'paid'].includes(run.status) && (
          <Link
            to="/payroll/disbursements"
            className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
          >
            Payment batches
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1.5 break-words text-lg font-semibold tracking-tight ${
          emphasis ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading...
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Landmark,
  Loader2,
  Printer,
  Receipt,
  Wallet,
} from 'lucide-react';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import { formatDate, formatMoney, formatNumber, getErrorMessage, titleCase } from '../payroll.utils';
import type { PayRunLine, Payslip } from '../payroll.types';

const EARNING_CATEGORIES = new Set(['earning']);
const DEDUCTION_CATEGORIES = new Set(['employee_deduction']);
const EMPLOYER_CATEGORIES = new Set(['employer_contribution']);

export function MePayslipsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const payslipsQuery = useQuery({
    queryKey: ['payroll', 'me', 'payslips'],
    queryFn: () => payrollService.getMyPayslips(),
  });

  const profileQuery = useQuery({
    queryKey: ['payroll', 'me', 'profile'],
    queryFn: () => payrollService.getMyPayProfile(),
    retry: false,
  });

  const payslips = payslipsQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && payslips.length > 0) {
      setSelectedId(payslips[0].id);
    }
  }, [payslips, selectedId]);

  const detailQuery = useQuery({
    queryKey: ['payroll', 'me', 'payslip', selectedId],
    queryFn: () => payrollService.getMyPayslip(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const markViewed = useMutation({
    mutationFn: (id: string) => payrollService.markPayslipViewed(id),
    onSuccess: (payslip) => {
      queryClient.setQueryData(['payroll', 'me', 'payslip', payslip.id], payslip);
      queryClient.invalidateQueries({ queryKey: ['payroll', 'me', 'payslips'] });
    },
  });

  const detail = detailQuery.data;

  useEffect(() => {
    if (detail && !detail.viewed_at) {
      markViewed.mutate(detail.id);
    }
    // markViewed is stable enough for this one-shot side effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, detail?.viewed_at]);

  const profile = profileQuery.data;
  const error = payslipsQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payslips</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Your pay history, take-home breakdown and year-to-date totals.
          </p>
        </div>
        {detail && (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print payslip
          </button>
        )}
      </div>

      {profile && <PaySetupCard profile={profile} />}

      {profileQuery.isError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">No pay profile on file</p>
            <p className="mt-0.5 text-xs leading-5">
              {getErrorMessage(profileQuery.error, 'Contact HR to complete your pay setup.')}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Unable to load payslips</p>
            <p className="mt-0.5 text-xs leading-5">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Pay history</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {formatNumber(payslips.length)} issued payslip(s)
            </p>
          </div>

          {payslipsQuery.isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : payslips.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <Receipt className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">No payslips yet</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                A payslip is issued to you automatically when payroll is finalized and
                approved.
              </p>
            </div>
          ) : (
            <div className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto">
              {payslips.map((payslip) => {
                const active = payslip.id === selectedId;
                return (
                  <button
                    key={payslip.id}
                    type="button"
                    onClick={() => setSelectedId(payslip.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-primary/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {payslip.period_name ?? 'Payslip'}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Issued {formatDate(payslip.issued_at)}
                        {!payslip.viewed_at ? ' · New' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-gray-900">
                        {formatMoney(payslip.net_pay)}
                      </p>
                      <p className="text-[11px] text-gray-500">Net</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {!selectedId ? (
            <div className="flex min-h-[340px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-6 text-center">
              <Receipt className="h-6 w-6 text-gray-400" />
              <p className="mt-3 text-sm font-semibold text-gray-900">
                Select a payslip
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Choose a period from your pay history to view the full breakdown.
              </p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex min-h-[340px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading payslip...
            </div>
          ) : detailQuery.error ? (
            <div className="flex min-h-[200px] items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-semibold">Unable to load the payslip</p>
                <p className="mt-0.5 text-xs leading-5">
                  {getErrorMessage(detailQuery.error)}
                </p>
              </div>
            </div>
          ) : detail ? (
            <PayslipDetail payslip={detail} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function PaySetupCard({
  profile,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof payrollService.getMyPayProfile>>>;
}) {
  const primaryAccount = profile.bank_accounts.find((account) => account.is_primary)
    ?? profile.bank_accounts[0];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-gray-900">My pay setup</h3>
        {profile.payment_method && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
            <CreditCard className="h-3 w-3" />
            {titleCase(profile.payment_method)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">
            {profile.pay_type === 'hourly' ? 'Hourly rate' : 'Base pay'}
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900">
            {formatMoney(
              profile.pay_type === 'hourly' ? profile.hourly_rate : profile.base_amount,
              profile.currency,
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {profile.pay_type === 'hourly' ? 'per hour' : 'per period'} ·{' '}
            {profile.currency}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pay type</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {titleCase(profile.pay_type)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Overtime ×{Number(profile.overtime_multiplier ?? 1).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Bank account</p>
          <p className="mt-1 truncate text-lg font-semibold text-gray-900">
            {primaryAccount ? `•••• ${primaryAccount.account_number_last4}` : 'Not set'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-gray-500">
            {primaryAccount
              ? `${primaryAccount.bank_name} · ${titleCase(primaryAccount.verification_status)}`
              : 'Add a verified account with HR'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Active items</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatNumber(profile.recurring_components.length)} recurring item(s)
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {profile.loans.length > 0
              ? `${formatNumber(profile.loans.length)} loan(s) · ${formatMoney(
                  profile.loans.reduce(
                    (total, loan) => total + Number(loan.outstanding_balance),
                    0,
                  ),
                  profile.currency,
                )} outstanding`
              : 'No active staff loans'}
          </p>
        </div>
      </div>

      {(profile.recurring_components.length > 0 || profile.bank_accounts.length > 0) && (
        <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
          {profile.recurring_components.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Recurring items
              </p>
              <ul className="mt-2 space-y-1.5">
                {profile.recurring_components.slice(0, 5).map((component) => (
                  <li
                    key={component.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="truncate text-gray-600">
                      {component.name ?? component.code ?? 'Component'}
                    </span>
                    <span className="flex-shrink-0 font-medium tabular-nums text-gray-900">
                      {formatMoney(component.amount, profile.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {profile.bank_accounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Bank accounts
              </p>
              <ul className="mt-2 space-y-1.5">
                {profile.bank_accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-600">
                      <Landmark className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">
                        {account.bank_name} •••• {account.account_number_last4}
                      </span>
                    </span>
                    <span
                      className={
                        account.verification_status === 'verified'
                          ? 'inline-flex flex-shrink-0 items-center gap-1 font-medium text-emerald-700'
                          : 'flex-shrink-0 font-medium text-amber-700'
                      }
                    >
                      {account.verification_status === 'verified' && (
                        <BadgeCheck className="h-3 w-3" />
                      )}
                      {titleCase(account.verification_status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PayslipDetail({ payslip }: { payslip: Payslip }) {
  const earnings = payslip.lines.filter((line) =>
    EARNING_CATEGORIES.has(line.category),
  );
  const deductions = payslip.lines.filter((line) =>
    DEDUCTION_CATEGORIES.has(line.category),
  );
  const employerContributions = payslip.lines.filter((line) =>
    EMPLOYER_CATEGORIES.has(line.category),
  );
  const otherLines = payslip.lines.filter(
    (line) =>
      !EARNING_CATEGORIES.has(line.category) &&
      !DEDUCTION_CATEGORIES.has(line.category) &&
      !EMPLOYER_CATEGORIES.has(line.category),
  );

  const totalEmployer = useMemo(
    () =>
      employerContributions.reduce(
        (total, line) => total + Number(line.amount),
        0,
      ),
    [employerContributions],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              {payslip.period_name ?? 'Payslip'}
            </h3>
            <PayrollStatusBadge status={payslip.status} />
            {payslip.version > 1 && (
              <span className="text-[11px] font-medium text-gray-500">
                Version {payslip.version}
              </span>
            )}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Issued {formatDate(payslip.issued_at)}
            {payslip.viewed_at
              ? ` · Viewed ${formatDate(payslip.viewed_at)}`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Net pay</p>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {formatMoney(payslip.net_pay)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-3">
        <Summary label="Gross pay" value={formatMoney(payslip.gross_pay)} />
        <Summary
          label="Total deductions"
          value={formatMoney(payslip.total_deductions)}
        />
        <Summary label="Net pay" value={formatMoney(payslip.net_pay)} emphasis />
      </div>

      <div className="space-y-5 border-t border-gray-100 px-5 py-4">
        <LineSection
          title="Earnings"
          lines={earnings}
          empty="No earning lines were recorded for this period."
          tone="positive"
        />
        <LineSection
          title="Employee deductions"
          lines={deductions}
          extra={otherLines}
          empty="No deductions were applied to this payslip."
          tone="negative"
        />
        <LineSection
          title="Employer contributions"
          lines={employerContributions}
          empty="No employer contributions for this period."
          tone="neutral"
          footer={
            employerContributions.length > 0
              ? `Employer cost: ${formatMoney(totalEmployer)}`
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:grid-cols-3">
        <Ytd label="YTD gross" value={formatMoney(payslip.ytd_gross)} />
        <Ytd label="YTD deductions" value={formatMoney(payslip.ytd_deductions)} />
        <Ytd label="YTD net" value={formatMoney(payslip.ytd_net)} />
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-1 tabular-nums ${
          emphasis ? 'text-lg font-bold text-primary' : 'text-lg font-semibold text-gray-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Ytd({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function LineSection({
  title,
  lines,
  extra = [],
  empty,
  tone,
  footer,
}: {
  title: string;
  lines: PayRunLine[];
  extra?: PayRunLine[];
  empty: string;
  tone: 'positive' | 'negative' | 'neutral';
  footer?: string;
}) {
  const all = [...lines, ...extra];
  const amountClasses =
    tone === 'positive'
      ? 'text-emerald-700'
      : tone === 'negative'
        ? 'text-red-700'
        : 'text-gray-700';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {title}
        </h4>
        {footer && (
          <span className="text-[11px] font-medium text-gray-500">{footer}</span>
        )}
      </div>
      {all.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-100">
            <tbody className="divide-y divide-gray-100">
              {all.map((line) => (
                <tr key={line.id} className="bg-white">
                  <td className="px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{line.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {line.code}
                      {line.quantity != null && Number(line.quantity) !== 0
                        ? ` · ${formatNumber(line.quantity, 2)} × ${formatMoney(
                            line.rate,
                          )}`
                        : ''}
                      {line.source === 'timesheet' ? ' · from approved timesheet' : ''}
                    </p>
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 text-right text-sm font-semibold tabular-nums ${amountClasses}`}
                  >
                    {tone === 'negative' ? '−' : ''}
                    {formatMoney(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

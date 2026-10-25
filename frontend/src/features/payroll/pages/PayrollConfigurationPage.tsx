import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Layers,
  Landmark,
  Loader2,
  Plus,
  RefreshCcw,
  Settings2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatNumber,
  formatPercent,
  getErrorMessage,
  inputClasses,
  labelClasses,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import type { StatutoryScheme, TaxBand } from '../payroll.types';

type ConfigTab = 'periods' | 'groups' | 'schemes' | 'components';

const GHANA_BANDS: TaxBand[] = [
  { sequence: 1, band_from: '0', band_to: '490', rate: '0' },
  { sequence: 2, band_from: '490', band_to: '600', rate: '0.05' },
  { sequence: 3, band_from: '600', band_to: '730', rate: '0.10' },
  { sequence: 4, band_from: '730', band_to: '3896.67', rate: '0.175' },
  { sequence: 5, band_from: '3896.67', band_to: '19896.67', rate: '0.25' },
  { sequence: 6, band_from: '19896.67', band_to: '50416.67', rate: '0.30' },
  { sequence: 7, band_from: '50416.67', band_to: null, rate: '0.35' },
];

export function PayrollConfigurationPage() {
  const access = useHRAccess();
  const [tab, setTab] = useState<ConfigTab>('periods');
  const [dialog, setDialog] = useState<ConfigTab | 'generate' | null>(null);

  const periodsQuery = useQuery({
    queryKey: ['payroll', 'periods'],
    queryFn: () => payrollService.getPayPeriods(),
  });
  const groupsQuery = useQuery({
    queryKey: ['payroll', 'groups'],
    queryFn: () => payrollService.getPayGroups(false),
  });
  const schemesQuery = useQuery({
    queryKey: ['payroll', 'schemes'],
    queryFn: () => payrollService.getStatutorySchemes(true),
  });
  const componentsQuery = useQuery({
    queryKey: ['payroll', 'components'],
    queryFn: () => payrollService.getComponentTypes(),
  });

  const canConfigure = access.has('payroll.config');
  const loading =
    periodsQuery.isLoading ||
    groupsQuery.isLoading ||
    schemesQuery.isLoading ||
    componentsQuery.isLoading;
  const error =
    periodsQuery.error ?? groupsQuery.error ?? schemesQuery.error ?? componentsQuery.error;

  const refresh = () => {
    periodsQuery.refetch();
    groupsQuery.refetch();
    schemesQuery.refetch();
    componentsQuery.refetch();
  };

  const tabs: { key: ConfigTab; label: string }[] = [
    { key: 'periods', label: 'Pay periods' },
    { key: 'groups', label: 'Pay groups' },
    { key: 'schemes', label: 'Statutory schemes' },
    { key: 'components', label: 'Pay components' },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Configuration
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Effective-dated periods, pay groups, statutory schemes and pay
            components used by the calculation engine.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load payroll configuration</p>
            <p className="mt-1">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      {!canConfigure && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          You have read-only access to payroll configuration.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 pt-3">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === item.key
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading configuration...
          </div>
        ) : (
          <>
            {tab === 'periods' && (
              <PeriodsPanel
                periods={periodsQuery.data ?? []}
                canConfigure={canConfigure}
                onAdd={() => setDialog('periods')}
                onGenerate={() => setDialog('generate')}
              />
            )}
            {tab === 'groups' && (
              <GroupsPanel
                groups={groupsQuery.data ?? []}
                canConfigure={canConfigure}
                onAdd={() => setDialog('groups')}
              />
            )}
            {tab === 'schemes' && (
              <SchemesPanel
                schemes={schemesQuery.data ?? []}
                canConfigure={canConfigure}
                onAdd={() => setDialog('schemes')}
              />
            )}
            {tab === 'components' && (
              <ComponentsPanel
                components={componentsQuery.data ?? []}
                canConfigure={canConfigure}
                onAdd={() => setDialog('components')}
              />
            )}
          </>
        )}
      </section>

      {dialog === 'periods' && (
        <CreatePeriodDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'generate' && (
        <GeneratePeriodsDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'groups' && (
        <CreateGroupDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'schemes' && (
        <CreateSchemeDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'components' && (
        <CreateComponentDialog onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function PeriodsPanel({
  periods,
  canConfigure,
  onAdd,
  onGenerate,
}: {
  periods: Awaited<ReturnType<typeof payrollService.getPayPeriods>>;
  canConfigure: boolean;
  onAdd: () => void;
  onGenerate: () => void;
}) {
  return (
    <div>
      <PanelHeader
        icon={CalendarRange}
        title="Pay periods"
        description="Each run belongs to one period. Cut-off and pay dates drive the workflow."
      >
        {canConfigure && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Layers className="h-3.5 w-3.5" />
              Generate schedule
            </button>
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add period
            </button>
          </div>
        )}
      </PanelHeader>

      {periods.length === 0 ? (
        <EmptyRow
          title="No pay periods yet"
          text="Generate a schedule for weekly, bi-weekly, semi-monthly or monthly payroll."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Period</Th>
                <Th>Frequency</Th>
                <Th>Date range</Th>
                <Th>Cut-off</Th>
                <Th>Pay date</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map((period) => (
                <tr key={period.id}>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                    {period.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {titleCase(period.frequency)}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {formatDate(period.period_start)} – {formatDate(period.period_end)}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {formatDate(period.cutoff_at)}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {formatDate(period.pay_date)}
                  </td>
                  <td className="px-5 py-3">
                    <PayrollStatusBadge status={period.status} />
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

function GroupsPanel({
  groups,
  canConfigure,
  onAdd,
}: {
  groups: Awaited<ReturnType<typeof payrollService.getPayGroups>>;
  canConfigure: boolean;
  onAdd: () => void;
}) {
  return (
    <div>
      <PanelHeader
        icon={Layers}
        title="Pay groups"
        description="A group defines pay type, currency and whether overtime is paid."
      >
        {canConfigure && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add group
          </button>
        )}
      </PanelHeader>

      {groups.length === 0 ? (
        <EmptyRow
          title="No pay groups yet"
          text="Create at least one group before setting up employee pay profiles."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Group</Th>
                <Th>Pay type</Th>
                <Th>Currency</Th>
                <Th>Overtime</Th>
                <Th>Proration</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((group) => (
                <tr key={group.id}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.description ?? 'No description'}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {titleCase(group.pay_type)}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">{group.currency}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {group.overtime_eligible ? 'Eligible' : 'Not eligible'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {titleCase(group.proration_basis)}
                  </td>
                  <td className="px-5 py-3">
                    <PayrollStatusBadge status={group.is_active ? 'active' : 'inactive'} />
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

function SchemesPanel({
  schemes,
  canConfigure,
  onAdd,
}: {
  schemes: StatutoryScheme[];
  canConfigure: boolean;
  onAdd: () => void;
}) {
  return (
    <div>
      <PanelHeader
        icon={Landmark}
        title="Statutory schemes"
        description="Tax bands and social security schemes applied before voluntary deductions."
      >
        {canConfigure && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add scheme
          </button>
        )}
      </PanelHeader>

      {schemes.length === 0 ? (
        <EmptyRow
          title="No statutory schemes yet"
          text="Add PAYE (with tax bands) and social security before calculating a run."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {schemes.map((scheme) => (
            <div key={scheme.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{scheme.name}</p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {scheme.code}
                    </span>
                    <PayrollStatusBadge status={scheme.is_active ? 'active' : 'inactive'} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {titleCase(scheme.scheme_type)} · Base {scheme.base} · Effective{' '}
                    {formatDate(scheme.effective_from)}
                    {scheme.effective_to ? ` – ${formatDate(scheme.effective_to)}` : ''}
                    {scheme.remittance_due_day
                      ? ` · Due day ${scheme.remittance_due_day}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                  {scheme.scheme_type === 'tax' ? (
                    <div>
                      <span className="text-slate-500">Bands: </span>
                      <span className="font-semibold text-slate-800">
                        {scheme.bands.length}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-500">Employee: </span>
                        <span className="font-semibold text-slate-800">
                          {formatPercent(scheme.employee_rate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Employer: </span>
                        <span className="font-semibold text-slate-800">
                          {formatPercent(scheme.employer_rate)}
                        </span>
                      </div>
                    </>
                  )}
                  {scheme.cap && (
                    <div>
                      <span className="text-slate-500">Cap: </span>
                      <span className="font-semibold text-slate-800">
                        {formatNumber(scheme.cap, 2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {scheme.scheme_type === 'tax' && scheme.bands.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {scheme.bands.map((band) => (
                    <span
                      key={`${band.sequence}-${band.band_from}`}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
                    >
                      {formatNumber(band.band_from, 2)} –{' '}
                      {band.band_to ? formatNumber(band.band_to, 2) : 'above'} ·{' '}
                      {formatPercent(band.rate)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentsPanel({
  components,
  canConfigure,
  onAdd,
}: {
  components: Awaited<ReturnType<typeof payrollService.getComponentTypes>>;
  canConfigure: boolean;
  onAdd: () => void;
}) {
  return (
    <div>
      <PanelHeader
        icon={Settings2}
        title="Pay components"
        description="Reusable earnings, employee deductions and employer contributions."
      >
        {canConfigure && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add component
          </button>
        )}
      </PanelHeader>

      {components.length === 0 ? (
        <EmptyRow
          title="No pay components yet"
          text="Add components such as allowances, union dues or employer pension."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Component</Th>
                <Th>Category</Th>
                <Th>Calculation</Th>
                <Th>Taxable</Th>
                <Th>Statutory</Th>
                <Th>GL account</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {components.map((component) => (
                <tr key={component.id}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {component.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{component.code}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {titleCase(component.category)}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {titleCase(component.calculation)}
                    {component.calculation === 'percent'
                      ? ` (${formatPercent(component.default_rate)})`
                      : ` (${formatNumber(component.default_amount, 2)})`}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {component.taxable ? 'Yes' : 'No'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {component.statutory ? 'Yes' : 'No'}
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-600">
                    {component.gl_account ?? '—'}
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

// ============================================================
// DIALOGS
// ============================================================

function BaseDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function CreatePeriodDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    frequency: 'monthly',
    period_start: '',
    period_end: '',
    pay_date: '',
    cutoff_at: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createPayPeriod({
        name: form.name,
        frequency: form.frequency,
        period_start: form.period_start,
        period_end: form.period_end,
        pay_date: form.pay_date,
        cutoff_at: form.cutoff_at || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      toast.success('Pay period created');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create the period')),
  });

  return (
    <BaseDialog
      title="Add pay period"
      description="pay_date must be on or after the period end date."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className={inputClasses()}
            placeholder="October 2026"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Frequency">
            <select
              value={form.frequency}
              onChange={(event) => setForm({ ...form, frequency: event.target.value })}
              className={inputClasses()}
            >
              <option value="monthly">Monthly</option>
              <option value="semi_monthly">Semi-monthly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Cut-off (optional)">
            <input
              type="date"
              value={form.cutoff_at}
              onChange={(event) => setForm({ ...form, cutoff_at: event.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label="Period start">
            <input
              required
              type="date"
              value={form.period_start}
              onChange={(event) =>
                setForm({ ...form, period_start: event.target.value })
              }
              className={inputClasses()}
            />
          </Field>
          <Field label="Period end">
            <input
              required
              type="date"
              value={form.period_end}
              onChange={(event) => setForm({ ...form, period_end: event.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label="Pay date">
            <input
              required
              type="date"
              value={form.pay_date}
              onChange={(event) => setForm({ ...form, pay_date: event.target.value })}
              className={inputClasses()}
            />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className={inputClasses()}
          />
        </Field>

        <DialogActions onClose={onClose} pending={mutation.isPending} label="Create period" />
      </form>
    </BaseDialog>
  );
}

function GeneratePeriodsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    frequency: 'monthly' as 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly',
    start_date: '',
    end_date: '',
    pay_day_offset: '0',
    cutoff_days_before_end: '0',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.generatePayPeriods({
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date,
        pay_day_offset: Number(form.pay_day_offset || 0),
        cutoff_days_before_end: Number(form.cutoff_days_before_end || 0),
      }),
    onSuccess: (periods) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      toast.success(
        periods.length === 0
          ? 'No new periods were needed'
          : `${periods.length} pay period(s) generated`,
      );
      onClose();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Could not generate the schedule')),
  });

  return (
    <BaseDialog
      title="Generate pay periods"
      description="Existing periods for the same frequency and date range are skipped."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Frequency">
            <select
              value={form.frequency}
              onChange={(event) =>
                setForm({
                  ...form,
                  frequency: event.target.value as typeof form.frequency,
                })
              }
              className={inputClasses()}
            >
              <option value="monthly">Monthly</option>
              <option value="semi_monthly">Semi-monthly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
          <Field label="Pay day offset (days after period end)">
            <input
              type="number"
              min={0}
              max={60}
              value={form.pay_day_offset}
              onChange={(event) =>
                setForm({ ...form, pay_day_offset: event.target.value })
              }
              className={inputClasses()}
            />
          </Field>
          <Field label="Start date">
            <input
              required
              type="date"
              value={form.start_date}
              onChange={(event) => setForm({ ...form, start_date: event.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label="End date">
            <input
              required
              type="date"
              value={form.end_date}
              onChange={(event) => setForm({ ...form, end_date: event.target.value })}
              className={inputClasses()}
            />
          </Field>
          <Field label="Cut-off days before period end">
            <input
              type="number"
              min={0}
              max={30}
              value={form.cutoff_days_before_end}
              onChange={(event) =>
                setForm({ ...form, cutoff_days_before_end: event.target.value })
              }
              className={inputClasses()}
            />
          </Field>
        </div>

        <DialogActions
          onClose={onClose}
          pending={mutation.isPending}
          label="Generate periods"
        />
      </form>
    </BaseDialog>
  );
}

function CreateGroupDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    description: '',
    pay_type: 'salaried',
    currency: 'GHS',
    overtime_eligible: false,
    proration_basis: 'working_days',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createPayGroup({
        name: form.name,
        description: form.description || undefined,
        pay_type: form.pay_type,
        currency: form.currency.toUpperCase(),
        overtime_eligible: form.overtime_eligible,
        proration_basis: form.proration_basis,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'groups'] });
      toast.success('Pay group created');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create the group')),
  });

  return (
    <BaseDialog
      title="Add pay group"
      description="Choose the dominant pay type. Individual profiles can still override it."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClasses()}
              placeholder="Core staff"
            />
          </Field>
          <Field label="Currency">
            <input
              required
              maxLength={3}
              value={form.currency}
              onChange={(event) =>
                setForm({ ...form, currency: event.target.value.toUpperCase() })
              }
              className={inputClasses()}
            />
          </Field>
          <Field label="Pay type">
            <select
              value={form.pay_type}
              onChange={(event) => setForm({ ...form, pay_type: event.target.value })}
              className={inputClasses()}
            >
              <option value="salaried">Salaried</option>
              <option value="hourly">Hourly</option>
              <option value="mixed">Mixed</option>
            </select>
          </Field>
          <Field label="Proration basis">
            <select
              value={form.proration_basis}
              onChange={(event) =>
                setForm({ ...form, proration_basis: event.target.value })
              }
              className={inputClasses()}
            >
              <option value="working_days">Working days</option>
              <option value="calendar_days">Calendar days</option>
            </select>
          </Field>
        </div>

        <Field label="Description (optional)">
          <input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className={inputClasses()}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.overtime_eligible}
            onChange={(event) =>
              setForm({ ...form, overtime_eligible: event.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300"
          />
          Overtime is payable for this group
        </label>

        <DialogActions onClose={onClose} pending={mutation.isPending} label="Create group" />
      </form>
    </BaseDialog>
  );
}

function CreateSchemeDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    code: '',
    scheme_type: 'tax',
    jurisdiction: 'GH',
    employee_rate: '5.5',
    employer_rate: '13',
    base: 'basic',
    cap: '',
    relief_amount: '0',
    remittance_due_day: '14',
    effective_from: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [bands, setBands] = useState<TaxBand[]>(GHANA_BANDS.map((band) => ({ ...band })));

  const isTax = form.scheme_type === 'tax';

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createStatutoryScheme({
        name: form.name,
        code: form.code.toUpperCase(),
        scheme_type: form.scheme_type,
        jurisdiction: form.jurisdiction,
        base: form.base,
        employee_rate: isTax ? 0 : Number(form.employee_rate) / 100,
        employer_rate: isTax ? 0 : Number(form.employer_rate) / 100,
        cap: form.cap ? Number(form.cap) : null,
        relief_amount: Number(form.relief_amount || 0),
        remittance_due_day: form.remittance_due_day
          ? Number(form.remittance_due_day)
          : null,
        effective_from: form.effective_from,
        notes: form.notes || undefined,
        bands: isTax
          ? bands.map((band, index) => ({
              sequence: index + 1,
              band_from: Number(band.band_from),
              band_to: band.band_to === null ? null : Number(band.band_to),
              rate: Number(band.rate),
            }))
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'schemes'] });
      toast.success('Statutory scheme created');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create the scheme')),
  });

  const updateBand = (index: number, patch: Partial<TaxBand>) => {
    setBands((current) =>
      current.map((band, bandIndex) =>
        bandIndex === index ? { ...band, ...patch } : band,
      ),
    );
  };

  return (
    <BaseDialog
      title="Add statutory scheme"
      description="Rates are entered as percentages. Tax bands must be contiguous and the last band open-ended."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClasses()}
              placeholder="PAYE"
            />
          </Field>
          <Field label="Code">
            <input
              required
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              className={inputClasses()}
              placeholder="PAYE"
            />
          </Field>
          <Field label="Scheme type">
            <select
              value={form.scheme_type}
              onChange={(event) =>
                setForm({ ...form, scheme_type: event.target.value })
              }
              className={inputClasses()}
            >
              <option value="tax">Income tax (bands)</option>
              <option value="social_security">Social security</option>
              <option value="other">Other statutory</option>
            </select>
          </Field>
          <Field label="Calculation base">
            <select
              value={form.base}
              onChange={(event) => setForm({ ...form, base: event.target.value })}
              className={inputClasses()}
            >
              <option value="basic">Basic pay</option>
              <option value="gross">Gross pay</option>
              <option value="taxable">Taxable gross</option>
            </select>
          </Field>
          <Field label="Effective from">
            <input
              required
              type="date"
              value={form.effective_from}
              onChange={(event) =>
                setForm({ ...form, effective_from: event.target.value })
              }
              className={inputClasses()}
            />
          </Field>
          <Field label="Remittance due day">
            <input
              type="number"
              min={1}
              max={31}
              value={form.remittance_due_day}
              onChange={(event) =>
                setForm({ ...form, remittance_due_day: event.target.value })
              }
              className={inputClasses()}
            />
          </Field>
        </div>

        {!isTax && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Employee rate (%)">
              <input
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={form.employee_rate}
                onChange={(event) =>
                  setForm({ ...form, employee_rate: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>
            <Field label="Employer rate (%)">
              <input
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={form.employer_rate}
                onChange={(event) =>
                  setForm({ ...form, employer_rate: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>
            <Field label="Cap (optional)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.cap}
                onChange={(event) => setForm({ ...form, cap: event.target.value })}
                className={inputClasses()}
                placeholder="No cap"
              />
            </Field>
          </div>
        )}

        {isTax && (
          <div className="rounded-lg border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">Tax bands</p>
              <button
                type="button"
                onClick={() =>
                  setBands((current) => [
                    ...current,
                    {
                      sequence: current.length + 1,
                      band_from: current[current.length - 1]?.band_to ?? '0',
                      band_to: null,
                      rate: '0.35',
                    },
                  ])
                }
                className="text-xs font-semibold text-slate-700 hover:text-slate-950"
              >
                Add band
              </button>
            </div>

            <div className="space-y-2 p-3">
              {bands.map((band, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={band.band_from}
                    onChange={(event) =>
                      updateBand(index, { band_from: event.target.value })
                    }
                    className={inputClasses()}
                    placeholder="From"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={band.band_to ?? ''}
                    onChange={(event) =>
                      updateBand(index, {
                        band_to: event.target.value || null,
                      })
                    }
                    className={inputClasses()}
                    placeholder="To (blank = above)"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.001"
                    required
                    value={Number(band.rate) * 100}
                    onChange={(event) =>
                      updateBand(index, {
                        rate: String(Number(event.target.value) / 100),
                      })
                    }
                    className={inputClasses()}
                    placeholder="Rate %"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBands((current) => current.filter((_, i) => i !== index))
                    }
                    className="rounded-lg border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className={inputClasses()}
          />
        </Field>

        <DialogActions
          onClose={onClose}
          pending={mutation.isPending}
          label="Create scheme"
        />
      </form>
    </BaseDialog>
  );
}

function CreateComponentDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'earning',
    calculation: 'fixed',
    default_amount: '',
    default_rate: '',
    calculation_base: 'gross',
    taxable: true,
    gl_account: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createComponentType({
        code: form.code.toUpperCase(),
        name: form.name,
        category: form.category,
        calculation: form.calculation,
        default_amount: Number(form.default_amount || 0),
        default_rate: Number(form.default_rate || 0) / 100,
        calculation_base: form.calculation_base,
        taxable: form.taxable,
        gl_account: form.gl_account || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'components'] });
      toast.success('Pay component created');
      onClose();
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Could not create the component')),
  });

  return (
    <BaseDialog
      title="Add pay component"
      description="Fixed components use an amount; percentage components use a rate."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className={inputClasses()}
              placeholder="Transport allowance"
            />
          </Field>
          <Field label="Code">
            <input
              required
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              className={inputClasses()}
              placeholder="TRANSPORT"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className={inputClasses()}
            >
              <option value="earning">Earning</option>
              <option value="employee_deduction">Employee deduction</option>
              <option value="employer_contribution">Employer contribution</option>
            </select>
          </Field>
          <Field label="Calculation">
            <select
              value={form.calculation}
              onChange={(event) =>
                setForm({ ...form, calculation: event.target.value })
              }
              className={inputClasses()}
            >
              <option value="fixed">Fixed amount</option>
              <option value="percent">Percentage</option>
            </select>
          </Field>
          {form.calculation === 'fixed' ? (
            <Field label="Default amount">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.default_amount}
                onChange={(event) =>
                  setForm({ ...form, default_amount: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>
          ) : (
            <Field label="Default rate (%)">
              <input
                type="number"
                min={0}
                max={100}
                step="0.001"
                value={form.default_rate}
                onChange={(event) =>
                  setForm({ ...form, default_rate: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>
          )}
          <Field label="Calculation base">
            <select
              value={form.calculation_base}
              onChange={(event) =>
                setForm({ ...form, calculation_base: event.target.value })
              }
              className={inputClasses()}
            >
              <option value="gross">Gross</option>
              <option value="basic">Basic</option>
              <option value="taxable">Taxable gross</option>
            </select>
          </Field>
          <Field label="GL account (optional)">
            <input
              value={form.gl_account}
              onChange={(event) => setForm({ ...form, gl_account: event.target.value })}
              className={inputClasses()}
              placeholder="5100"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.taxable}
            onChange={(event) => setForm({ ...form, taxable: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          This component is taxable
        </label>

        <Field label="Notes (optional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            className={inputClasses()}
          />
        </Field>

        <DialogActions
          onClose={onClose}
          pending={mutation.isPending}
          label="Create component"
        />
      </form>
    </BaseDialog>
  );
}

// ============================================================
// SHARED
// ============================================================

function PanelHeader({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClasses()}>{label}</label>
      {children}
    </div>
  );
}

function DialogActions({
  onClose,
  pending,
  label,
}: {
  onClose: () => void;
  pending: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {pending ? 'Saving…' : label}
      </button>
    </div>
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

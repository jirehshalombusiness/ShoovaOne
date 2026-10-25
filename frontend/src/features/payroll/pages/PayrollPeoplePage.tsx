import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRoundCog,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { peopleService } from '@/services/people.service';
import { PayrollStatusBadge } from '../PayrollStatusBadge';
import { payrollService } from '../payroll.service';
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  getErrorMessage,
  inputClasses,
  labelClasses,
  titleCase,
} from '../payroll.utils';
import { useHRAccess } from '@/hooks/useHRAccess';
import type { ComponentType, PayProfile } from '../payroll.types';

type Tab = 'profiles' | 'setup';

export function PayrollPeoplePage() {
  const access = useHRAccess();
  const [tab, setTab] = useState<Tab>('profiles');
  const [search, setSearch] = useState('');
  const [editingProfile, setEditingProfile] = useState<PayProfile | 'new' | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');

  const canSetup = access.has(['payroll.prepare', 'payroll.config']);
  const canVerify = access.has(['payroll.review_finance', 'payroll.approve']);

  const profilesQuery = useQuery({
    queryKey: ['payroll', 'profiles', search],
    queryFn: () => payrollService.getProfiles({ search: search || undefined }),
  });

  const groupsQuery = useQuery({
    queryKey: ['payroll', 'groups'],
    queryFn: () => payrollService.getPayGroups(),
  });

  const componentsQuery = useQuery({
    queryKey: ['payroll', 'components'],
    queryFn: () => payrollService.getComponentTypes(),
    enabled: tab === 'setup',
  });

  const peopleQuery = useQuery({
    queryKey: ['people', 'payroll-setup'],
    queryFn: () => peopleService.getAll({ limit: 500 }),
    enabled: tab === 'setup',
  });

  const profiles = profilesQuery.data ?? [];
  const error = profilesQuery.error ?? groupsQuery.error;

  const refresh = () => {
    profilesQuery.refetch();
    groupsQuery.refetch();
    componentsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Payroll</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Employee pay
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Pay profiles, verified bank accounts, recurring earnings/deductions and
            staff loans. These feed the calculation engine for each run.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>

          {canSetup && (
            <button
              type="button"
              onClick={() => setEditingProfile('new')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Set up pay
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Unable to load employee pay data</p>
            <p className="mt-1">{getErrorMessage(error)}</p>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 pt-3">
          <button
            type="button"
            onClick={() => setTab('profiles')}
            className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === 'profiles'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wallet className="h-4 w-4" />
            Pay profiles ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('setup')}
            className={`inline-flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === 'setup'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserRoundCog className="h-4 w-4" />
            Employee setup
          </button>
        </div>

        {tab === 'profiles' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Active pay profiles
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  A new profile on a later effective date closes the previous one
                  automatically.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${inputClasses()} pl-9`}
                  placeholder="Search name or employee number"
                />
              </div>
            </div>

            {profilesQuery.isLoading ? (
              <LoadingRow />
            ) : profiles.length === 0 ? (
              <EmptyRow
                icon={Wallet}
                title="No pay profiles found"
                text="Set up a pay profile before creating a run. Employees without one are skipped."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Employee</Th>
                      <Th>Pay type</Th>
                      <Th align="right">Base / hourly</Th>
                      <Th>Overtime</Th>
                      <Th>Effective</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {profile.person_name ?? 'Employee'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {profile.department ?? 'No department'} ·{' '}
                            {profile.payment_method.replace(/_/g, ' ')}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {titleCase(profile.pay_type)}
                        </td>
                        <td className="px-5 py-3 text-right text-sm text-slate-700">
                          {profile.pay_type === 'hourly' ? (
                            <>
                              {formatMoney(profile.hourly_rate, profile.currency)}
                              <span className="text-xs text-slate-500"> /hour</span>
                            </>
                          ) : (
                            <>
                              {formatMoney(profile.base_amount, profile.currency)}
                              {profile.hourly_rate &&
                                Number(profile.hourly_rate) > 0 && (
                                  <p className="text-xs text-slate-500">
                                    {formatMoney(profile.hourly_rate, profile.currency)}
                                    /hour OT
                                  </p>
                                )}
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          ×{formatNumber(profile.overtime_multiplier, 2)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {formatDate(profile.effective_from)}
                          {profile.effective_to
                            ? ` – ${formatDate(profile.effective_to)}`
                            : ''}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canSetup && (
                            <button
                              type="button"
                              onClick={() => setEditingProfile(profile)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Update
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <EmployeeSetup
            people={peopleQuery.data ?? []}
            peopleLoading={peopleQuery.isLoading}
            profiles={profiles}
            groups={groupsQuery.data ?? []}
            allComponents={componentsQuery.data ?? []}
            selectedPersonId={selectedPersonId}
            setSelectedPersonId={setSelectedPersonId}
            canSetup={canSetup}
            canVerify={canVerify}
            onSetupProfile={() => setEditingProfile('new')}
          />
        )}
      </section>

      {editingProfile && (
        <ProfileDialog
          initial={editingProfile === 'new' ? null : editingProfile}
          profiles={profiles}
          groups={groupsQuery.data ?? []}
          selectedPersonId={selectedPersonId}
          onClose={() => setEditingProfile(null)}
        />
      )}
    </div>
  );
}

function EmployeeSetup({
  people,
  peopleLoading,
  profiles,
  groups,
  allComponents,
  selectedPersonId,
  setSelectedPersonId,
  canSetup,
  canVerify,
  onSetupProfile,
}: {
  people: Awaited<ReturnType<typeof peopleService.getAll>>;
  peopleLoading: boolean;
  profiles: PayProfile[];
  groups: Awaited<ReturnType<typeof payrollService.getPayGroups>>;
  allComponents: ComponentType[];
  selectedPersonId: string;
  setSelectedPersonId: (id: string) => void;
  canSetup: boolean;
  canVerify: boolean;
  onSetupProfile: () => void;
}) {
  const selectedPerson = people.find((person) => person.id === selectedPersonId);
  const profile = profiles.find((item) => item.person_id === selectedPersonId);

  return (
    <div>
      <div className="border-b border-slate-200 px-5 py-4">
        <label className={labelClasses()} htmlFor="payroll-person">
          Select an employee
        </label>
        <select
          id="payroll-person"
          value={selectedPersonId}
          onChange={(event) => setSelectedPersonId(event.target.value)}
          className={`${inputClasses()} max-w-xl`}
        >
          <option value="">
            {peopleLoading ? 'Loading employees…' : 'Choose an employee'}
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.first_name} {person.last_name}
              {person.employee_number ? ` · ${person.employee_number}` : ''}
              {person.department ? ` · ${person.department}` : ''}
            </option>
          ))}
        </select>
      </div>

      {!selectedPersonId ? (
        <EmptyRow
          icon={UserRoundCog}
          title="Choose an employee"
          text="Select an employee to manage bank details, recurring pay components and loans."
        />
      ) : (
        <div className="space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedPerson
                  ? `${selectedPerson.first_name} ${selectedPerson.last_name}`
                  : 'Selected employee'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {profile
                  ? `${titleCase(profile.pay_type)} · ${
                      profile.pay_type === 'hourly'
                        ? `${formatMoney(profile.hourly_rate, profile.currency)} /hour`
                        : `${formatMoney(profile.base_amount, profile.currency)} /period`
                    } · ${profile.currency}`
                  : 'No active pay profile'}
              </p>
            </div>

            {canSetup && !profile && (
              <button
                type="button"
                onClick={onSetupProfile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Set up pay profile
              </button>
            )}
          </div>

          <BankAccountsSection
            personId={selectedPersonId}
            canSetup={canSetup}
            canVerify={canVerify}
          />

          <RecurringSection
            personId={selectedPersonId}
            allComponents={allComponents}
            currency={profile?.currency ?? 'GHS'}
            canSetup={canSetup}
          />

          <LoansSection
            personId={selectedPersonId}
            canSetup={canSetup}
            canVerify={canVerify}
          />

          <div className="px-5 py-3 text-xs text-slate-500">
            {groups.length === 0
              ? 'Configure at least one pay group before creating profiles.'
              : 'Bank details are encrypted at rest; only the last four digits are shown.'}
          </div>
        </div>
      )}
    </div>
  );
}

function BankAccountsSection({
  personId,
  canSetup,
  canVerify,
}: {
  personId: string;
  canSetup: boolean;
  canVerify: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ['payroll', 'bank-accounts', personId],
    queryFn: () => payrollService.getBankAccounts(personId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['payroll', 'bank-accounts', personId] });

  const approve = useMutation({
    mutationFn: (accountId: string) => payrollService.approveBankAccount(accountId),
    onSuccess: () => {
      toast.success('Bank account verified');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not verify account')),
  });

  const reject = useMutation({
    mutationFn: ({ accountId, reason }: { accountId: string; reason: string }) =>
      payrollService.rejectBankAccount(accountId, reason),
    onSuccess: () => {
      toast.success('Bank account rejected');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not reject account')),
  });

  return (
    <div className="border-b border-slate-200 px-5 py-5">
      <SectionHeader
        icon={Banknote}
        title="Bank accounts"
        description="A verified primary account is required for bank transfer or mobile money."
        action={
          canSetup ? (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add account
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <BankAccountForm
          personId={personId}
          onClose={() => setShowForm(false)}
          onSaved={invalidate}
        />
      )}

      {query.isLoading ? (
        <InlineLoading />
      ) : (query.data ?? []).length === 0 ? (
        <InlineEmpty text="No bank accounts captured." />
      ) : (
        <div className="mt-3 space-y-2">
          {(query.data ?? []).map((account) => (
            <div
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {account.bank_name} ····{account.account_number_last4}
                  </p>
                  <PayrollStatusBadge status={account.verification_status} />
                  {account.is_primary && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      PRIMARY
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {account.account_name}
                  {account.mobile_money_provider
                    ? ` · ${account.mobile_money_provider}`
                    : ''}
                  {' · '}
                  effective {formatDate(account.effective_from)}
                </p>
                {account.verification_note && (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {account.verification_note}
                  </p>
                )}
              </div>

              {canVerify && account.verification_status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approve.mutate(account.id)}
                    disabled={approve.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt('Reason for rejecting this account');
                      if (!reason?.trim()) return;
                      reject.mutate({ accountId: account.id, reason: reason.trim() });
                    }}
                    disabled={reject.isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BankAccountForm({
  personId,
  onClose,
  onSaved,
}: {
  personId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    bank_name: '',
    branch: '',
    bank_code: '',
    account_name: '',
    account_number: '',
    mobile_money_provider: '',
    is_primary: true,
    effective_from: new Date().toISOString().slice(0, 10),
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createBankAccount(personId, {
        bank_name: form.bank_name,
        branch: form.branch || undefined,
        bank_code: form.bank_code || undefined,
        account_name: form.account_name,
        account_number: form.account_number,
        mobile_money_provider: form.mobile_money_provider || undefined,
        is_primary: form.is_primary,
        effective_from: form.effective_from,
      }),
    onSuccess: () => {
      toast.success('Bank account captured. It needs verification before use.');
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not save account')),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Bank name">
          <input
            required
            value={form.bank_name}
            onChange={(event) => setForm({ ...form, bank_name: event.target.value })}
            className={inputClasses()}
          />
        </Field>
        <Field label="Account name">
          <input
            required
            value={form.account_name}
            onChange={(event) =>
              setForm({ ...form, account_name: event.target.value })
            }
            className={inputClasses()}
          />
        </Field>
        <Field label="Account number">
          <input
            required
            minLength={4}
            value={form.account_number}
            onChange={(event) =>
              setForm({ ...form, account_number: event.target.value })
            }
            className={inputClasses()}
          />
        </Field>
        <Field label="Branch (optional)">
          <input
            value={form.branch}
            onChange={(event) => setForm({ ...form, branch: event.target.value })}
            className={inputClasses()}
          />
        </Field>
        <Field label="Bank code (optional)">
          <input
            value={form.bank_code}
            onChange={(event) => setForm({ ...form, bank_code: event.target.value })}
            className={inputClasses()}
          />
        </Field>
        <Field label="Mobile money provider (optional)">
          <input
            value={form.mobile_money_provider}
            onChange={(event) =>
              setForm({ ...form, mobile_money_provider: event.target.value })
            }
            className={inputClasses()}
          />
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
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={form.is_primary}
          onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Use as primary salary account
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save account'}
        </button>
      </div>
    </form>
  );
}

function RecurringSection({
  personId,
  allComponents,
  currency,
  canSetup,
}: {
  personId: string;
  allComponents: ComponentType[];
  currency: string;
  canSetup: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ['payroll', 'recurring', personId],
    queryFn: () => payrollService.getRecurringComponents(personId),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => payrollService.deactivateRecurringComponent(id),
    onSuccess: () => {
      toast.success('Recurring component deactivated');
      queryClient.invalidateQueries({ queryKey: ['payroll', 'recurring', personId] });
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not deactivate')),
  });

  return (
    <div className="border-b border-slate-200 px-5 py-5">
      <SectionHeader
        icon={Wallet}
        title="Recurring earnings & deductions"
        description="Applied every run while active, in priority order."
        action={
          canSetup ? (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add component
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <RecurringForm
          personId={personId}
          allComponents={allComponents}
          onClose={() => setShowForm(false)}
          onSaved={() =>
            queryClient.invalidateQueries({
              queryKey: ['payroll', 'recurring', personId],
            })
          }
        />
      )}

      {query.isLoading ? (
        <InlineLoading />
      ) : (query.data ?? []).length === 0 ? (
        <InlineEmpty text="No active recurring components." />
      ) : (
        <div className="mt-3 space-y-2">
          {(query.data ?? []).map((component) => (
            <div
              key={component.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {component.component_name ?? component.component_code}
                  </p>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {titleCase(component.component_category)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {Number(component.rate) > 0
                    ? formatPercent(component.rate)
                    : formatMoney(component.amount, currency)}
                  {' · '}
                  effective {formatDate(component.effective_from)}
                  {component.remaining_amount
                    ? ` · remaining ${formatNumber(component.remaining_amount, 2)}`
                    : ''}
                </p>
              </div>

              {canSetup && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Deactivate this recurring component?')) {
                      deactivate.mutate(component.id);
                    }
                  }}
                  disabled={deactivate.isPending}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Deactivate
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecurringForm({
  personId,
  allComponents,
  onClose,
  onSaved,
}: {
  personId: string;
  allComponents: ComponentType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    component_type_id: allComponents[0]?.id ?? '',
    amount: '',
    rate: '',
    effective_from: new Date().toISOString().slice(0, 10),
    remaining_amount: '',
    notes: '',
  });

  const selected = allComponents.find(
    (component) => component.id === form.component_type_id,
  );

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createRecurringComponent(personId, {
        component_type_id: form.component_type_id,
        amount: Number(form.amount || 0),
        rate: Number(form.rate || 0) / 100,
        effective_from: form.effective_from,
        remaining_amount: form.remaining_amount
          ? Number(form.remaining_amount)
          : null,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Recurring component added');
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not add component')),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      {allComponents.length === 0 ? (
        <p className="text-xs text-amber-700">
          Create non-statutory pay components in Payroll → Configuration first.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Component">
              <select
                required
                value={form.component_type_id}
                onChange={(event) =>
                  setForm({ ...form, component_type_id: event.target.value })
                }
                className={inputClasses()}
              >
                <option value="">Select component</option>
                {allComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name} · {titleCase(component.category)}
                  </option>
                ))}
              </select>
            </Field>

            {selected?.calculation === 'percent' ? (
              <Field label="Rate (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.001"
                  required
                  value={form.rate}
                  onChange={(event) => setForm({ ...form, rate: event.target.value })}
                  className={inputClasses()}
                />
              </Field>
            ) : (
              <Field label="Amount">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  className={inputClasses()}
                />
              </Field>
            )}

            <Field label="Effective from">
              <input
                type="date"
                required
                value={form.effective_from}
                onChange={(event) =>
                  setForm({ ...form, effective_from: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Remaining amount (optional)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.remaining_amount}
                onChange={(event) =>
                  setForm({ ...form, remaining_amount: event.target.value })
                }
                className={inputClasses()}
                placeholder="For limited recoveries"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <input
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={inputClasses()}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Add component'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function LoansSection({
  personId,
  canSetup,
  canVerify,
}: {
  personId: string;
  canSetup: boolean;
  canVerify: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const query = useQuery({
    queryKey: ['payroll', 'loans', personId],
    queryFn: () => payrollService.getLoans(personId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['payroll', 'loans', personId] });

  const approve = useMutation({
    mutationFn: (id: string) => payrollService.approveLoan(id),
    onSuccess: () => {
      toast.success('Loan approved and repayment schedule created');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not approve loan')),
  });

  return (
    <div className="px-5 py-5">
      <SectionHeader
        icon={ShieldCheck}
        title="Staff loans"
        description="Approved loans are deducted automatically, subject to available net pay."
        action={
          canSetup ? (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add loan
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <LoanForm personId={personId} onClose={() => setShowForm(false)} onSaved={invalidate} />
      )}

      {query.isLoading ? (
        <InlineLoading />
      ) : (query.data ?? []).length === 0 ? (
        <InlineEmpty text="No staff loans on file." />
      ) : (
        <div className="mt-3 space-y-2">
          {(query.data ?? []).map((loan) => (
            <div
              key={loan.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatNumber(loan.outstanding_balance, 2)} outstanding
                  </p>
                  <PayrollStatusBadge status={loan.status} />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Principal {formatNumber(loan.principal, 2)} ·{' '}
                  {formatNumber(loan.installment_amount, 2)} × {loan.term_months}{' '}
                  months · starts {formatDate(loan.start_date)}
                </p>
              </div>

              {canVerify && loan.status === 'pending_approval' && (
                <button
                  type="button"
                  onClick={() => approve.mutate(loan.id)}
                  disabled={approve.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve loan
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoanForm({
  personId,
  onClose,
  onSaved,
}: {
  personId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    principal: '',
    interest_rate: '0',
    installment_amount: '',
    term_months: '12',
    start_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.createLoan(personId, {
        principal: Number(form.principal),
        interest_rate: Number(form.interest_rate || 0) / 100,
        installment_amount: Number(form.installment_amount),
        term_months: Number(form.term_months),
        start_date: form.start_date,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Loan created and awaiting approval');
      onSaved();
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not create loan')),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
      className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Principal">
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.principal}
            onChange={(event) => setForm({ ...form, principal: event.target.value })}
            className={inputClasses()}
          />
        </Field>
        <Field label="Annual interest (%)">
          <input
            type="number"
            min={0}
            max={100}
            step="0.001"
            value={form.interest_rate}
            onChange={(event) =>
              setForm({ ...form, interest_rate: event.target.value })
            }
            className={inputClasses()}
          />
        </Field>
        <Field label="Monthly installment">
          <input
            type="number"
            min={0.01}
            step="0.01"
            required
            value={form.installment_amount}
            onChange={(event) =>
              setForm({ ...form, installment_amount: event.target.value })
            }
            className={inputClasses()}
          />
        </Field>
        <Field label="Term (months)">
          <input
            type="number"
            min={1}
            required
            value={form.term_months}
            onChange={(event) =>
              setForm({ ...form, term_months: event.target.value })
            }
            className={inputClasses()}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            required
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
            className={inputClasses()}
          />
        </Field>
      </div>

      <Field label="Notes (optional)">
        <input
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          className={inputClasses()}
        />
      </Field>

      <p className="text-[11px] leading-5 text-slate-500">
        Interest is charged flat over the term. Installments must cover the total
        repayable but not repay it before the final month.
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Create loan'}
        </button>
      </div>
    </form>
  );
}

function ProfileDialog({
  initial,
  profiles,
  groups,
  selectedPersonId,
  onClose,
}: {
  initial: PayProfile | null;
  profiles: PayProfile[];
  groups: Awaited<ReturnType<typeof payrollService.getPayGroups>>;
  selectedPersonId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const peopleQuery = useQuery({
    queryKey: ['people', 'payroll-setup'],
    queryFn: () => peopleService.getAll({ limit: 500 }),
  });

  const knownProfile = initial
    ? profiles.find((profile) => profile.id === initial.id) ?? initial
    : null;

  const [form, setForm] = useState({
    person_id: knownProfile?.person_id ?? selectedPersonId,
    pay_group_id: knownProfile?.pay_group_id ?? groups[0]?.id ?? '',
    pay_type: knownProfile?.pay_type ?? 'salaried',
    base_amount: knownProfile ? String(knownProfile.base_amount) : '',
    hourly_rate: knownProfile ? String(knownProfile.hourly_rate) : '',
    currency: knownProfile?.currency ?? 'GHS',
    overtime_multiplier: knownProfile ? String(knownProfile.overtime_multiplier) : '1.5',
    payment_method: knownProfile?.payment_method ?? 'bank_transfer',
    department: knownProfile?.department ?? '',
    cost_center: knownProfile?.cost_center ?? '',
    effective_from:
      knownProfile?.effective_from ?? new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      payrollService.upsertProfile({
        person_id: form.person_id,
        pay_group_id: form.pay_group_id || null,
        pay_type: form.pay_type,
        base_amount: Number(form.base_amount || 0),
        hourly_rate: Number(form.hourly_rate || 0),
        currency: form.currency.toUpperCase(),
        overtime_multiplier: Number(form.overtime_multiplier || 1),
        payment_method: form.payment_method,
        department: form.department || undefined,
        cost_center: form.cost_center || undefined,
        effective_from: form.effective_from,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'profiles'] });
      toast.success('Pay profile saved');
      onClose();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not save the profile')),
  });

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
            <h2 className="text-base font-semibold text-slate-950">
              {initial ? 'Update pay profile' : 'Set up employee pay'}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              Saving a later effective date keeps the prior profile in history and
              closes it the day before.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.person_id) {
              toast.error('Select an employee');
              return;
            }
            mutation.mutate();
          }}
          className="space-y-4 overflow-y-auto p-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee">
              <select
                required
                value={form.person_id}
                onChange={(event) => setForm({ ...form, person_id: event.target.value })}
                className={inputClasses()}
                disabled={Boolean(knownProfile)}
              >
                <option value="">Select employee</option>
                {(peopleQuery.data ?? []).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                    {person.employee_number ? ` · ${person.employee_number}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Pay group">
              <select
                value={form.pay_group_id}
                onChange={(event) =>
                  setForm({ ...form, pay_group_id: event.target.value })
                }
                className={inputClasses()}
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
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

            <Field label="Currency">
              <input
                maxLength={3}
                required
                value={form.currency}
                onChange={(event) =>
                  setForm({ ...form, currency: event.target.value.toUpperCase() })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Base amount per period">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.base_amount}
                onChange={(event) =>
                  setForm({ ...form, base_amount: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Hourly rate (overtime / hourly pay)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.hourly_rate}
                onChange={(event) =>
                  setForm({ ...form, hourly_rate: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Overtime multiplier">
              <input
                type="number"
                min={0.1}
                step="0.01"
                value={form.overtime_multiplier}
                onChange={(event) =>
                  setForm({ ...form, overtime_multiplier: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Payment method">
              <select
                value={form.payment_method}
                onChange={(event) =>
                  setForm({ ...form, payment_method: event.target.value })
                }
                className={inputClasses()}
              >
                <option value="bank_transfer">Bank transfer</option>
                <option value="mobile_money">Mobile money</option>
                <option value="check">Cheque</option>
                <option value="cash">Cash</option>
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

            <Field label="Department (optional)">
              <input
                value={form.department}
                onChange={(event) =>
                  setForm({ ...form, department: event.target.value })
                }
                className={inputClasses()}
              />
            </Field>

            <Field label="Cost centre (optional)">
              <input
                value={form.cost_center}
                onChange={(event) =>
                  setForm({ ...form, cost_center: event.target.value })
                }
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
              disabled={mutation.isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {mutation.isPending ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      {action}
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

function LoadingRow() {
  return (
    <div className="flex min-h-[280px] items-center justify-center text-sm text-slate-500">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Loading...
    </div>
  );
}

function InlineLoading() {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading...
    </div>
  );
}

function InlineEmpty({ text }: { text: string }) {
  return <p className="mt-3 text-xs text-slate-500">{text}</p>;
}

function EmptyRow({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{text}</p>
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

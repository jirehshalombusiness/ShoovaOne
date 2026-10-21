import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  Building2,
  User,
  DollarSign,
  Calendar,
  Target,
  Users,
  FileText,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { crmService, type OpportunityCreatePayload } from '@/services/crm.service';
import { peopleService } from '@/services/people.service';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';

// ============================================================
// LOCAL TYPES
// ============================================================

interface OrgOption {
  id: string;
  name: string;
  type?: string | null;
}

interface PersonOption {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
}

// ============================================================
// PAGE
// ============================================================

export function NewOpportunityPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<OpportunityCreatePayload>({
    title: '',
    type: 'partnership',
    organisation_id: '',
    owner_id: '',
    source: 'outbound',
    strategic_priority: 'medium',
    currency: 'GHS',
    amount_type: 'one_time',
    eligibility_check: 'unknown',
    competitors: [],
    required_documents: [],
  });

  const [competitorInput, setCompetitorInput] = useState('');
  const [documentInput, setDocumentInput] = useState('');

  // Load organisations
  const { data: orgs } = useQuery({
    queryKey: ['organisations', 'for-select'],
    queryFn: async (): Promise<OrgOption[]> => {
      try {
        const { data } = await api.get<OrgOption[]>('/organisation');
        return data;
      } catch {
        return [];
      }
    },
  });

  // Load staff for owner select
  const { data: staff } = useQuery({
    queryKey: ['people', 'staff-for-owner'],
    queryFn: () => peopleService.getAll({ type: 'staff', limit: 200 }),
  });

  // Load external contacts for primary contact
  const { data: contacts } = useQuery({
    queryKey: ['people', 'external-contacts'],
    queryFn: () => peopleService.getAll({ type: 'external_contact', limit: 500 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: OpportunityCreatePayload) =>
      crmService.createOpportunity(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm'] });
      toast.success('Opportunity created');
      navigate(`/crm/opportunities/${data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to create opportunity');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.organisation_id) return toast.error('Select an organisation');
    if (!form.owner_id) return toast.error('Assign an owner');

    createMutation.mutate(form);
  };

  const updateField = <K extends keyof OpportunityCreatePayload>(
    key: K,
    value: OpportunityCreatePayload[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addCompetitor = () => {
    if (!competitorInput.trim()) return;
    updateField('competitors', [...(form.competitors || []), competitorInput.trim()]);
    setCompetitorInput('');
  };

  const removeCompetitor = (idx: number) => {
    updateField('competitors', (form.competitors || []).filter((_, i) => i !== idx));
  };

  const addDocument = () => {
    if (!documentInput.trim()) return;
    updateField('required_documents', [
      ...(form.required_documents || []),
      documentInput.trim(),
    ]);
    setDocumentInput('');
  };

  const removeDocument = (idx: number) => {
    updateField('required_documents', (form.required_documents || []).filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-5xl space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/crm/pipeline')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Opportunity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Capture the essentials. You can fill in the details after creation.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ============================================================ */}
        {/* BASICS */}
        {/* ============================================================ */}
        <Section icon={Sparkles} title="Basics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Field label="Title" required>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Ghana Education Partnership 2026"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>
            </div>

            <Field label="Type" required>
              <select
                required
                value={form.type}
                onChange={(e) =>
                  updateField('type', e.target.value as OpportunityCreatePayload['type'])
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="grant">Grant</option>
                <option value="partnership">Partnership</option>
                <option value="contract">Contract</option>
                <option value="programme">Programme</option>
              </select>
            </Field>

            <div className="md:col-span-3">
              <Field label="Description">
                <textarea
                  value={form.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  placeholder="What is this opportunity about?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* ORGANISATION & CONTACT */}
        {/* ============================================================ */}
        <Section icon={Building2} title="Organisation & Contact">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Organisation" required>
              <select
                required
                value={form.organisation_id}
                onChange={(e) => updateField('organisation_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select organisation…</option>
                {(orgs ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                    {org.type ? ` — ${org.type}` : ''}
                  </option>
                ))}
              </select>
              {(!orgs || orgs.length === 0) && (
                <p className="text-[11px] text-amber-700 mt-1">
                  No organisations yet. Create one first via the Organisations tab.
                </p>
              )}
            </Field>

            <Field label="Primary contact">
              <select
                value={form.primary_contact_id || ''}
                onChange={(e) =>
                  updateField('primary_contact_id', e.target.value || undefined)
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">None</option>
                {(contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.email ? ` · ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* VALUE & TIMING */}
        {/* ============================================================ */}
        <Section icon={DollarSign} title="Value & Timing">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Field label="Amount">
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount ?? ''}
                    onChange={(e) =>
                      updateField('amount', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </Field>
            </div>

            <Field label="Currency">
              <input
                type="text"
                maxLength={3}
                value={form.currency ?? 'GHS'}
                onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Amount type">
              <select
                value={form.amount_type ?? 'one_time'}
                onChange={(e) => updateField('amount_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="one_time">One-time</option>
                <option value="recurring">Recurring</option>
                <option value="milestone">Milestone-based</option>
              </select>
            </Field>

            <Field label="Expected close">
              <input
                type="date"
                value={form.expected_close_date || ''}
                onChange={(e) => updateField('expected_close_date', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Expected start">
              <input
                type="date"
                value={form.expected_start_date || ''}
                onChange={(e) => updateField('expected_start_date', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <Field label="Duration (months)">
              <input
                type="number"
                min="0"
                max="240"
                value={form.expected_duration_months ?? ''}
                onChange={(e) =>
                  updateField(
                    'expected_duration_months',
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Decision timeline">
                <input
                  type="text"
                  value={form.decision_timeline || ''}
                  onChange={(e) => updateField('decision_timeline', e.target.value)}
                  placeholder="e.g. Board approves in March"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* SOURCE & OWNERSHIP */}
        {/* ============================================================ */}
        <Section icon={User} title="Source & Ownership">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Source">
              <select
                value={form.source ?? 'outbound'}
                onChange={(e) =>
                  updateField('source', e.target.value as OpportunityCreatePayload['source'])
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="referral">Referral</option>
                <option value="event">Event</option>
                <option value="existing_relationship">Existing relationship</option>
              </select>
            </Field>

            <Field label="Referred by">
              <select
                value={form.referred_by_id || ''}
                onChange={(e) => updateField('referred_by_id', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Nobody</option>
                {(staff ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Campaign">
              <input
                type="text"
                value={form.campaign || ''}
                onChange={(e) => updateField('campaign', e.target.value)}
                placeholder="e.g. Education Summit 2026"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>

            <div className="md:col-span-3">
              <Field label="Owner" required>
                <select
                  required
                  value={form.owner_id}
                  onChange={(e) => updateField('owner_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Select owner…</option>
                  {(staff ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* STRATEGIC FIT */}
        {/* ============================================================ */}
        <Section icon={Target} title="Strategic Fit">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Priority">
              <select
                value={form.strategic_priority ?? 'medium'}
                onChange={(e) =>
                  updateField(
                    'strategic_priority',
                    e.target.value as OpportunityCreatePayload['strategic_priority'],
                  )
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>

            <Field label="Eligibility check">
              <select
                value={form.eligibility_check ?? 'unknown'}
                onChange={(e) =>
                  updateField(
                    'eligibility_check',
                    e.target.value as OpportunityCreatePayload['eligibility_check'],
                  )
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes — we qualify</option>
                <option value="no">No — not eligible</option>
              </select>
            </Field>

            <div className="md:col-span-3">
              <Field label="Alignment notes">
                <textarea
                  value={form.alignment_notes || ''}
                  onChange={(e) => updateField('alignment_notes', e.target.value)}
                  rows={2}
                  placeholder="How does this fit Shoova's mission?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* COMPETITION & RISK */}
        {/* ============================================================ */}
        <Section icon={Users} title="Competition & Risk">
          <div className="space-y-4">
            {/* Competitors */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Competing organisations
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={competitorInput}
                  onChange={(e) => setCompetitorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCompetitor();
                    }
                  }}
                  placeholder="Type a name and press Enter"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={addCompetitor}
                  disabled={!competitorInput.trim()}
                  className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {(form.competitors || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(form.competitors || []).map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-[11px] text-gray-700"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCompetitor(i)}
                        className="hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Competitive advantage">
                <textarea
                  value={form.competitive_advantage || ''}
                  onChange={(e) => updateField('competitive_advantage', e.target.value)}
                  rows={2}
                  placeholder="Why us?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>

              <Field label="Known risks">
                <textarea
                  value={form.known_risks || ''}
                  onChange={(e) => updateField('known_risks', e.target.value)}
                  rows={2}
                  placeholder="What could go wrong?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>
            </div>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* REQUIREMENTS */}
        {/* ============================================================ */}
        <Section icon={FileText} title="Requirements">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Required documents from us
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDocument();
                    }
                  }}
                  placeholder="e.g. Registration certificate"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={addDocument}
                  disabled={!documentInput.trim()}
                  className="px-3 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              {(form.required_documents || []).length > 0 && (
                <div className="space-y-1">
                  {(form.required_documents || []).map((d, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-gray-50 text-[12px]"
                    >
                      <span className="text-gray-700">{d}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(i)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Field label="Compliance notes">
              <textarea
                value={form.compliance_notes || ''}
                onChange={(e) => updateField('compliance_notes', e.target.value)}
                rows={2}
                placeholder="Any special compliance requirements?"
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </Field>
          </div>
        </Section>

        {/* ============================================================ */}
        {/* ACTIONS */}
        {/* ============================================================ */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <AlertCircle className="w-3.5 h-3.5" />
            The opportunity will start in the <strong>Discovery</strong> stage
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/crm/pipeline')}
              className="px-4 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {createMutation.isPending ? 'Creating…' : 'Create Opportunity'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
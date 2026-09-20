import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    Banknote,
    CalendarDays,
    CheckCircle2,
    Circle,
    FileCheck2,
    FileText,
    Loader2,
    MessageSquare,
    Send,
    ShieldCheck,
    XCircle,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/lib/auth';

import { financeService } from '../finance.service';
import type {
    FundRequest,
    FundRequestStatus,
} from '../finance.types';

import { FundRequestStatusBadge } from '../components/FundRequestStatusBadge';

function formatCurrency(
    amount: number,
    currency = 'GHS'
) {
    return new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(amount || 0));
}

function formatDate(
    date?: string | null,
    includeTime = false
) {
    if (!date) return '—';

    return new Intl.DateTimeFormat('en-GH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(includeTime
            ? {
                hour: '2-digit',
                minute: '2-digit',
            }
            : {}),
    }).format(new Date(date));
}

function getErrorMessage(error: any) {
    return (
        error?.response?.data?.detail ||
        error?.message ||
        'Something went wrong. Please try again.'
    );
}

interface WorkflowStep {
    key: string;
    label: string;
    description: string;
    date?: string | null;
    completed: boolean;
    current: boolean;
    rejected?: boolean;
}

export function FundRequestDetailPage() {
    const { requestId } = useParams<{ requestId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [request, setRequest] =
        useState<FundRequest | null>(null);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] =
        useState(false);

    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] =
        useState<string | null>(null);

    const [showActionPanel, setShowActionPanel] =
        useState(false);

    const [actionType, setActionType] = useState<
        'review' |
        'approve' |
        'reject' |
        'disburse' |
        'reconcile' |
        null
    >(null);

    const [notes, setNotes] = useState('');
    const [approvedAmount, setApprovedAmount] =
        useState('');
    const [disbursementAmount, setDisbursementAmount] =
        useState('');

    const permissions = user?.permissions ?? [];

    const hasPermission = useCallback(
        (permission: string) =>
            permissions.includes(permission),
        [permissions]
    );

    const loadRequest = useCallback(async () => {
        if (!requestId) return;

        try {
            setLoading(true);
            setError(null);

            const data =
                await financeService.getFundRequest(requestId);

            setRequest(data);
        } catch (err: any) {
            console.error(
                'Failed to load fund request:',
                err
            );

            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [requestId]);

    useEffect(() => {
        loadRequest();
    }, [loadRequest]);

    const workflow = useMemo<WorkflowStep[]>(() => {
        if (!request) return [];

        const statusOrder = [
            'draft',
            'submitted',
            'under_review',
            'approved',
            'disbursed',
            'reconciled',
        ];

        const currentIndex =
            statusOrder.indexOf(request.status);

        return [
            {
                key: 'draft',
                label: 'Draft',
                description:
                    'Request created and being prepared.',
                date: request.created_at,
                completed: currentIndex >= 0,
                current: request.status === 'draft',
            },
            {
                key: 'submitted',
                label: 'Submitted',
                description:
                    'Request submitted for financial review.',
                date: request.submitted_at,
                completed: currentIndex >= 1,
                current: request.status === 'submitted',
            },
            {
                key: 'under_review',
                label: 'Under Review',
                description:
                    'Finance review is in progress.',
                date: request.reviewed_at,
                completed: currentIndex >= 2,
                current:
                    request.status === 'under_review',
            },
            {
                key: 'approved',
                label: 'Approved',
                description:
                    'Request approved for disbursement.',
                date: request.approved_at,
                completed: currentIndex >= 3,
                current: request.status === 'approved',
            },
            {
                key: 'disbursed',
                label: 'Disbursed',
                description:
                    'Approved funds have been disbursed.',
                date: request.disbursed_at,
                completed: currentIndex >= 4,
                current: request.status === 'disbursed',
            },
            {
                key: 'reconciled',
                label: 'Reconciled',
                description:
                    'Disbursement has been reconciled.',
                date: request.reconciled_at,
                completed: currentIndex >= 5,
                current:
                    request.status === 'reconciled',
            },
        ];
    }, [request]);

    const openAction = (
        type:
            | 'review'
            | 'approve'
            | 'reject'
            | 'disburse'
            | 'reconcile'
    ) => {
        setActionType(type);
        setNotes('');
        setActionError(null);

        if (type === 'approve') {
            setApprovedAmount(
                String(
                    request?.approved_amount ??
                    request?.amount_requested ??
                    ''
                )
            );
        }

        if (type === 'disburse') {
            const approved =
                Number(request?.approved_amount ?? 0);

            const alreadyDisbursed =
                Number(request?.amount_disbursed ?? 0);

            setDisbursementAmount(
                String(
                    Math.max(
                        approved - alreadyDisbursed,
                        0
                    )
                )
            );
        }

        setShowActionPanel(true);
    };

    const closeAction = () => {
        if (actionLoading) return;

        setShowActionPanel(false);
        setActionType(null);
        setNotes('');
        setActionError(null);
    };

    const executeAction = async () => {
        if (!requestId || !request || !actionType) {
            return;
        }

        try {
            setActionLoading(true);
            setActionError(null);

            let updated: FundRequest;

            switch (actionType) {
                case 'review':
                    updated =
                        await financeService.reviewFundRequest(
                            requestId,
                            notes || undefined
                        );
                    break;

                case 'approve': {
                    const amount = Number(approvedAmount);

                    if (!amount || amount <= 0) {
                        throw new Error(
                            'Enter a valid approved amount.'
                        );
                    }

                    updated =
                        await financeService.approveFundRequest(
                            requestId,
                            amount,
                            notes || undefined
                        );
                    break;
                }

                case 'reject':
                    if (!notes.trim()) {
                        throw new Error(
                            'A rejection reason is required.'
                        );
                    }

                    updated =
                        await financeService.rejectFundRequest(
                            requestId,
                            notes.trim()
                        );
                    break;

                case 'disburse': {
                    const amount =
                        Number(disbursementAmount);

                    if (!amount || amount <= 0) {
                        throw new Error(
                            'Enter a valid disbursement amount.'
                        );
                    }

                    updated =
                        await financeService.disburseFundRequest(
                            requestId,
                            amount,
                            notes || undefined
                        );
                    break;
                }

                case 'reconcile':
                    updated =
                        await financeService.reconcileFundRequest(
                            requestId,
                            notes || undefined
                        );
                    break;

                default:
                    return;
            }

            setRequest(updated);
            closeAction();
        } catch (err: any) {
            console.error(
                'Fund request action failed:',
                err
            );

            setActionError(getErrorMessage(err));
        } finally {
            setActionLoading(false);
        }
    };

    const actionConfig = useMemo(() => {
        if (!request) return null;

        switch (request.status) {
            case 'draft':
                if (hasPermission('finance.create')) {
                    return {
                        label: 'Submit Request',
                        type: 'submit' as const,
                        icon: Send,
                    };
                }

                return null;

            case 'submitted':
                if (hasPermission('finance.review')) {
                    return {
                        label: 'Review Request',
                        type: 'review' as const,
                        icon: ShieldCheck,
                    };
                }

                return null;

            case 'under_review':
                if (hasPermission('finance.approve')) {
                    return {
                        label: 'Approve Request',
                        type: 'approve' as const,
                        icon: CheckCircle2,
                    };
                }

                return null;

            case 'approved':
                if (hasPermission('finance.disburse')) {
                    return {
                        label: 'Disburse Funds',
                        type: 'disburse' as const,
                        icon: Banknote,
                    };
                }

                return null;

            case 'disbursed':
                if (hasPermission('finance.reconcile')) {
                    return {
                        label: 'Reconcile',
                        type: 'reconcile' as const,
                        icon: FileCheck2,
                    };
                }

                return null;

            default:
                return null;
        }
    }, [request, user, hasPermission]);

    const canReject =
        request &&
        (request.status === 'submitted' ||
            request.status === 'under_review') &&
        hasPermission('finance.reject');

    if (loading) {
        return (
            <div className="flex min-h-[500px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
            </div>
        );
    }

    if (error || !request) {
        return (
            <div className="space-y-5">
                <button
                    type="button"
                    onClick={() =>
                        navigate('/finance/fund-requests')
                    }
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Fund Requests
                </button>

                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-3">
                        <XCircle className="mt-0.5 h-5 w-5 text-red-600" />

                        <div>
                            <h2 className="font-semibold text-red-900">
                                Unable to load fund request
                            </h2>

                            <p className="mt-1 text-sm text-red-700">
                                {error ||
                                    'The requested fund request could not be found.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const remainingAmount =
        Number(request.approved_amount ?? 0) -
        Number(request.amount_disbursed ?? 0);

    const ActionIcon =
        actionConfig?.icon ?? Circle;

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={() =>
                            navigate('/finance/fund-requests')
                        }
                        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Fund Requests
                    </button>

                    <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-slate-500">
                            {request.request_number}
                        </span>

                        <FundRequestStatusBadge
                            status={request.status}
                        />
                    </div>

                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        {request.title}
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Created {formatDate(request.created_at)}
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {actionConfig && (
                        <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => {
                                if (actionConfig.type === 'submit') {
                                    if (!requestId) return;

                                    setActionLoading(true);
                                    setActionError(null);

                                    financeService
                                        .submitFundRequest(requestId)
                                        .then((updated) => {
                                            setRequest(updated);
                                        })
                                        .catch((err: any) => {
                                            console.error(
                                                'Failed to submit fund request:',
                                                err
                                            );

                                            setActionError(getErrorMessage(err));
                                        })
                                        .finally(() => {
                                            setActionLoading(false);
                                        });
                                } else {
                                    openAction(actionConfig.type);
                                }
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ActionIcon className="h-4 w-4" />
                            {actionConfig.label}
                        </button>
                    )}

                    {canReject && (
                        <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => openAction('reject')}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                            <XCircle className="h-4 w-4" />
                            Reject
                        </button>
                    )}
                </div>
            </div>

            {/* Financial summary */}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                    label="Requested"
                    value={formatCurrency(
                        request.amount_requested,
                        request.currency
                    )}
                    icon={Banknote}
                />

                <SummaryCard
                    label="Approved"
                    value={formatCurrency(
                        request.approved_amount ?? 0,
                        request.currency
                    )}
                    icon={CheckCircle2}
                />

                <SummaryCard
                    label="Disbursed"
                    value={formatCurrency(
                        request.amount_disbursed,
                        request.currency
                    )}
                    icon={Send}
                />

                <SummaryCard
                    label="Remaining"
                    value={formatCurrency(
                        Math.max(remainingAmount, 0),
                        request.currency
                    )}
                    icon={FileCheck2}
                />
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
                <div className="space-y-6">
                    {/* Request information */}
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-slate-500" />
                                <h2 className="font-semibold text-slate-950">
                                    Request Information
                                </h2>
                            </div>
                        </div>

                        <div className="grid gap-6 p-6 md:grid-cols-2">
                            <DetailItem
                                label="Requester ID"
                                value={request.requester_id}
                            />

                            <DetailItem
                                label="Project ID"
                                value={
                                    request.project_id ||
                                    'No project assigned'
                                }
                            />

                            <DetailItem
                                label="Programme ID"
                                value={
                                    request.programme_id || '—'
                                }
                            />

                            <DetailItem
                                label="Department ID"
                                value={
                                    request.department_id || '—'
                                }
                            />

                            <DetailItem
                                label="Required by"
                                value={
                                    request.required_by_date
                                        ? formatDate(
                                            request.required_by_date
                                        )
                                        : 'No deadline specified'
                                }
                                icon={CalendarDays}
                            />

                            <DetailItem
                                label="Currency"
                                value={request.currency}
                            />
                        </div>
                    </section>

                    {/* Description */}
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-4">
                            <h2 className="font-semibold text-slate-950">
                                Business Case
                            </h2>
                        </div>

                        <div className="space-y-6 p-6">
                            <TextBlock
                                label="Description"
                                value={request.description}
                            />

                            <TextBlock
                                label="Justification"
                                value={request.justification}
                            />
                        </div>
                    </section>

                    {/* Workflow */}
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-slate-500" />

                                <div>
                                    <h2 className="font-semibold text-slate-950">
                                        Approval Workflow
                                    </h2>

                                    <p className="text-xs text-slate-500">
                                        Controlled movement through the
                                        finance lifecycle
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="relative">
                                {workflow.map(
                                    (step, index) => (
                                        <div
                                            key={step.key}
                                            className="relative flex gap-4 pb-8 last:pb-0"
                                        >
                                            {index <
                                                workflow.length - 1 && (
                                                    <div
                                                        className={`absolute left-[11px] top-7 h-[calc(100%-8px)] w-px ${step.completed
                                                            ? 'bg-slate-900'
                                                            : 'bg-slate-200'
                                                            }`}
                                                    />
                                                )}

                                            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white">
                                                {step.completed ? (
                                                    <CheckCircle2
                                                        className={`h-6 w-6 ${step.current
                                                            ? 'text-slate-900'
                                                            : 'text-slate-500'
                                                            }`}
                                                    />
                                                ) : (
                                                    <Circle className="h-6 w-6 text-slate-300" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p
                                                        className={`text-sm font-semibold ${step.current
                                                            ? 'text-slate-950'
                                                            : 'text-slate-700'
                                                            }`}
                                                    >
                                                        {step.label}
                                                    </p>

                                                    {step.date && (
                                                        <span className="text-xs text-slate-400">
                                                            {formatDate(
                                                                step.date,
                                                                true
                                                            )}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="mt-1 text-sm text-slate-500">
                                                    {step.description}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                )}

                                {request.status ===
                                    'rejected' && (
                                        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                                            <div className="flex gap-3">
                                                <XCircle className="h-5 w-5 shrink-0 text-red-600" />

                                                <div>
                                                    <p className="text-sm font-semibold text-red-900">
                                                        Request rejected
                                                    </p>

                                                    <p className="mt-1 text-sm text-red-700">
                                                        {request.rejection_reason ||
                                                            'No rejection reason was recorded.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </div>
                    </section>

                    {/* Notes */}
                    {(request.review_notes ||
                        request.approval_notes ||
                        request.disbursement_notes ||
                        request.reconciliation_notes) && (
                            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5 text-slate-500" />

                                        <h2 className="font-semibold text-slate-950">
                                            Finance Notes
                                        </h2>
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    <NoteBlock
                                        label="Review Notes"
                                        value={request.review_notes}
                                    />

                                    <NoteBlock
                                        label="Approval Notes"
                                        value={request.approval_notes}
                                    />

                                    <NoteBlock
                                        label="Disbursement Notes"
                                        value={
                                            request.disbursement_notes
                                        }
                                    />

                                    <NoteBlock
                                        label="Reconciliation Notes"
                                        value={
                                            request.reconciliation_notes
                                        }
                                    />
                                </div>
                            </section>
                        )}
                </div>

                {/* Right rail */}
                <aside className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-5 py-4">
                            <h2 className="font-semibold text-slate-950">
                                Financial Control
                            </h2>
                        </div>

                        <div className="space-y-4 p-5">
                            <ControlRow
                                label="Requested"
                                value={formatCurrency(
                                    request.amount_requested,
                                    request.currency
                                )}
                            />

                            <ControlRow
                                label="Approved"
                                value={formatCurrency(
                                    request.approved_amount ?? 0,
                                    request.currency
                                )}
                            />

                            <ControlRow
                                label="Disbursed"
                                value={formatCurrency(
                                    request.amount_disbursed,
                                    request.currency
                                )}
                            />

                            <div className="border-t border-slate-100 pt-4">
                                <ControlRow
                                    label="Outstanding"
                                    value={formatCurrency(
                                        Math.max(
                                            Number(
                                                request.approved_amount ?? 0
                                            ) -
                                            Number(
                                                request.amount_disbursed ?? 0
                                            ),
                                            0
                                        ),
                                        request.currency
                                    )}
                                    strong
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-600" />

                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">
                                    Governance record
                                </h3>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Every workflow transition is
                                    recorded against this financial
                                    request for institutional
                                    accountability.
                                </p>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>

            {/* Action panel */}
            {showActionPanel && actionType && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-100 px-6 py-5">
                            <h2 className="text-lg font-semibold text-slate-950">
                                {getActionTitle(actionType)}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                {getActionDescription(actionType)}
                            </p>
                        </div>

                        <div className="space-y-5 p-6">
                            {actionError && (
                                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                    {actionError}
                                </div>
                            )}

                            {actionType === 'approve' && (
                                <Field
                                    label="Approved Amount"
                                    type="number"
                                    value={approvedAmount}
                                    onChange={setApprovedAmount}
                                    min="0"
                                    step="0.01"
                                    prefix={request.currency}
                                />
                            )}

                            {actionType === 'disburse' && (
                                <Field
                                    label="Disbursement Amount"
                                    type="number"
                                    value={disbursementAmount}
                                    onChange={setDisbursementAmount}
                                    min="0"
                                    step="0.01"
                                    prefix={request.currency}
                                />
                            )}

                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">
                                    {actionType === 'reject'
                                        ? 'Rejection Reason'
                                        : 'Notes'}

                                    {actionType === 'reject' && (
                                        <span className="text-red-500">
                                            {' '}
                                            *
                                        </span>
                                    )}
                                </label>

                                <textarea
                                    value={notes}
                                    onChange={(event) =>
                                        setNotes(event.target.value)
                                    }
                                    rows={4}
                                    placeholder={
                                        actionType === 'reject'
                                            ? 'Explain why this request is being rejected...'
                                            : 'Add an institutional note for the record...'
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                                />
                            </div>                  </div>

                        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={closeAction}
                                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={executeAction}
                                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${actionType === 'reject'
                                    ? 'bg-red-700 hover:bg-red-800'
                                    : 'bg-slate-900 hover:bg-slate-800'
                                    }`}
                            >
                                {actionLoading && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                )}

                                {actionLoading
                                    ? 'Processing...'
                                    : getActionButtonLabel(
                                        actionType
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof Banknote;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {label}
                </span>

                <Icon className="h-4 w-4 text-slate-400" />
            </div>

            <p className="mt-2 text-xl font-semibold text-slate-950">
                {value}
            </p>
        </div>
    );
}

function DetailItem({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon?: typeof CalendarDays;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {label}
            </p>

            <div className="mt-1 flex items-center gap-2">
                {Icon && (
                    <Icon className="h-4 w-4 text-slate-400" />
                )}

                <p className="break-all text-sm font-medium text-slate-800">
                    {value}
                </p>
            </div>
        </div>
    );
}

function TextBlock({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {label}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {value || 'No information provided.'}
            </p>
        </div>
    );
}

function NoteBlock({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    if (!value) return null;

    return (
        <div className="px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {value}
            </p>
        </div>
    );
}

function ControlRow({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">
                {label}
            </span>

            <span
                className={`text-sm ${strong
                    ? 'font-semibold text-slate-950'
                    : 'font-medium text-slate-800'
                    }`}
            >
                {value}
            </span>
        </div>
    );
}

function Field({
    label,
    type,
    value,
    onChange,
    min,
    step,
    prefix,
}: {
    label: string;
    type: string;
    value: string;
    onChange: (value: string) => void;
    min?: string;
    step?: string;
    prefix?: string;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
                {label}
            </label>

            <div className="relative">
                {prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                        {prefix}
                    </span>
                )}

                <input
                    type={type}
                    value={value}
                    onChange={(event) =>
                        onChange(event.target.value)
                    }
                    min={min}
                    step={step}
                    className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 ${prefix ? 'pl-14' : ''
                        }`}
                />
            </div>
        </div>
    );
}

function getActionTitle(
    action:
        | 'review'
        | 'approve'
        | 'reject'
        | 'disburse'
        | 'reconcile'
) {
    switch (action) {
        case 'review':
            return 'Review Fund Request';
        case 'approve':
            return 'Approve Fund Request';
        case 'reject':
            return 'Reject Fund Request';
        case 'disburse':
            return 'Disburse Funds';
        case 'reconcile':
            return 'Reconcile Fund Request';
    }
}

function getActionDescription(
    action:
        | 'review'
        | 'approve'
        | 'reject'
        | 'disburse'
        | 'reconcile'
) {
    switch (action) {
        case 'review':
            return 'Move this request into formal finance review.';
        case 'approve':
            return 'Authorize the amount that may be disbursed.';
        case 'reject':
            return 'Record the reason this request will not proceed.';
        case 'disburse':
            return 'Record the release of approved funds.';
        case 'reconcile':
            return 'Confirm that the disbursement has been reconciled.';
    }
}

function getActionButtonLabel(
    action:
        | 'review'
        | 'approve'
        | 'reject'
        | 'disburse'
        | 'reconcile'
) {
    switch (action) {
        case 'review':
            return 'Start Review';
        case 'approve':
            return 'Approve';
        case 'reject':
            return 'Reject Request';
        case 'disburse':
            return 'Record Disbursement';
        case 'reconcile':
            return 'Reconcile';
    }
}
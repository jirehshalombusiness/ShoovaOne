import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  ShoppingCart,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import { useHRAccess } from '@/hooks/useHRAccess';
import {
  deviceRequestService,
  type DeviceRequestRecord,
  type DeviceStockItem,
} from '@/services/deviceRequest.service';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_manager: 'Manager',
  pending_hr: 'HR review',
  pending_fulfilment: 'To fulfil',
  purchase_requested: 'On order',
  fulfilled: 'Fulfilled',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_manager: 'bg-amber-50 text-amber-700',
  pending_hr: 'bg-amber-50 text-amber-700',
  pending_fulfilment: 'bg-blue-50 text-blue-700',
  purchase_requested: 'bg-indigo-50 text-indigo-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'pending_fulfilment', label: 'To fulfil' },
  { value: 'purchase_requested', label: 'On order' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'all', label: 'All' },
];

function getErrorMessage(error: unknown) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;
  return (
    (error as { message?: string })?.message ||
    'Something went wrong. Please try again.'
  );
}

export function HRDevicesPage() {
  const access = useHRAccess();
  const canManage = access.has('devices.manage');
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState('open');
  const [activeRequest, setActiveRequest] =
    useState<DeviceRequestRecord | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['hr', 'device-requests'],
    queryFn: () => deviceRequestService.listAll(),
  });

  const stockQuery = useQuery({
    queryKey: ['hr', 'device-stock'],
    queryFn: () => deviceRequestService.stock(),
    enabled: canManage,
  });

  const requests = requestsQuery.data ?? [];
  const stock = stockQuery.data ?? [];

  const visible = useMemo(() => {
    if (filter === 'all') return requests;
    if (filter === 'open') {
      return requests.filter((request) =>
        [
          'draft',
          'pending_manager',
          'pending_hr',
          'pending_fulfilment',
          'purchase_requested',
        ].includes(request.status)
      );
    }
    return requests.filter((request) => request.status === filter);
  }, [requests, filter]);

  const counts = useMemo(
    () => ({
      toFulfil: requests.filter(
        (request) => request.status === 'pending_fulfilment'
      ).length,
      onOrder: requests.filter(
        (request) => request.status === 'purchase_requested'
      ).length,
      fulfilled: requests.filter(
        (request) => request.status === 'fulfilled'
      ).length,
    }),
    [requests]
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Devices</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Equipment requests and the device register
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          label="To fulfil"
          value={counts.toFulfil}
          tone="amber"
        />
        <SummaryCard label="On order" value={counts.onOrder} tone="blue" />
        <SummaryCard
          label="Available in stock"
          value={stock.length}
          tone="emerald"
        />
      </div>

      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors',
                filter === option.value
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {requestsQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : requestsQuery.error ? (
          <div className="flex items-start gap-3 m-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800">
              Could not load device requests.
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            Nothing here right now.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {visible.map((request) => (
              <div
                key={request.id}
                className="px-4 py-3 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-gray-900">
                      {request.item_name}
                    </span>
                    <StatusPill status={request.status} />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {request.requester_name} ·{' '}
                    {request.category.replace(/_/g, ' ')} ·{' '}
                    {request.request_number}
                    {request.needed_by &&
                      ` · needed ${format(
                        new Date(request.needed_by),
                        'MMM d'
                      )}`}
                  </div>
                  {request.purchase_reference && (
                    <div className="text-[11px] text-indigo-700 mt-1">
                      Purchase ref {request.purchase_reference}
                    </div>
                  )}
                  {request.hr_decision_note && (
                    <div className="text-[11px] text-gray-500 mt-1 italic">
                      {request.hr_decision_note}
                    </div>
                  )}
                </div>

                {canManage &&
                  ['pending_fulfilment', 'purchase_requested'].includes(
                    request.status
                  ) && (
                    <button
                      onClick={() => setActiveRequest(request)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Fulfil
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeRequest && (
        <FulfilModal
          request={activeRequest}
          stock={stock}
          onClose={() => setActiveRequest(null)}
          onDone={() => {
            setActiveRequest(null);
            queryClient.invalidateQueries({
              queryKey: ['hr', 'device-requests'],
            });
            queryClient.invalidateQueries({
              queryKey: ['hr', 'device-stock'],
            });
          }}
        />
      )}
    </div>
  );
}

function FulfilModal({
  request,
  stock,
  onClose,
  onDone,
}: {
  request: DeviceRequestRecord;
  stock: DeviceStockItem[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'assign' | 'purchase'>('assign');
  const [deviceId, setDeviceId] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState(
    request.purchase_reference ?? ''
  );
  const [error, setError] = useState<string | null>(null);

  const assignMutation = useMutation({
    mutationFn: () =>
      deviceRequestService.assign(request.id, {
        device_id: deviceId,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Device assigned');
      onDone();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const purchaseMutation = useMutation({
    mutationFn: () =>
      deviceRequestService.recordPurchase(request.id, {
        purchase_reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Purchase recorded');
      onDone();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const busy = assignMutation.isPending || purchaseMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={busy ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Fulfil request
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {request.item_name} · {request.requester_name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('assign')}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs font-medium',
                mode === 'assign'
                  ? 'border-gray-900 bg-gray-50 text-gray-900'
                  : 'border-gray-200 text-gray-600'
              )}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Assign from stock
            </button>
            <button
              type="button"
              onClick={() => setMode('purchase')}
              className={cn(
                'flex items-center justify-center gap-2 px-3 py-2 rounded border text-xs font-medium',
                mode === 'purchase'
                  ? 'border-gray-900 bg-gray-50 text-gray-900'
                  : 'border-gray-200 text-gray-600'
              )}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Record purchase
            </button>
          </div>

          {mode === 'assign' ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Available device
              </label>
              <select
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select a device…</option>
                {stock.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} · {device.category}
                    {device.serial_number ? ` · ${device.serial_number}` : ''}
                  </option>
                ))}
              </select>
              {stock.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1.5">
                  No unassigned devices in the register. Record a purchase
                  instead.
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Purchase reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="PO number or fund request number"
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Raise the purchase in Finance if it needs budget approval,
                then record the reference here. Assign the device once it
                arrives.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Note
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note for the employee record."
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              mode === 'assign'
                ? assignMutation.mutate()
                : purchaseMutation.mutate()
            }
            disabled={
              busy || (mode === 'assign' && !deviceId)
            }
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'assign' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <ShoppingCart className="w-4 h-4" />
            )}
            {mode === 'assign' ? 'Assign device' : 'Record purchase'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'blue' | 'emerald';
}) {
  const tones: Record<string, string> = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4 flex items-center gap-3">
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
          tones[tone]
        )}
      >
        {value}
      </div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
        STATUS_STYLES[status] ?? STATUS_STYLES.draft
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

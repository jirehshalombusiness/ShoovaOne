import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Laptop,
  Loader2,
  Monitor,
  Package,
  Plus,
  Router,
  Send,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import { api } from '@/services/api';
import {
  deviceRequestService,
  type DeviceCategory,
  type DeviceRequestRecord,
} from '@/services/deviceRequest.service';
import { cn } from '@/lib/utils';

interface MeDevice {
  id: string;
  assignment_id: string;
  name: string;
  category: string;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  condition: string;
  assigned_at: string | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  laptop: Laptop,
  monitor: Monitor,
  phone: Smartphone,
  mobile: Smartphone,
  tablet: Tablet,
  router: Router,
  sim_card: Smartphone,
  peripheral: Package,
  other: Package,
};

const REQUEST_CATEGORIES: { value: DeviceCategory; label: string }[] = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'phone', label: 'Phone' },
  { value: 'sim_card', label: 'SIM card' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'peripheral', label: 'Accessory' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_manager: 'With manager',
  pending_hr: 'With HR',
  pending_fulfilment: 'Approved',
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
  purchase_requested: 'bg-blue-50 text-blue-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const OPEN_STATUSES = new Set([
  'draft',
  'pending_manager',
  'pending_hr',
  'pending_fulfilment',
  'purchase_requested',
]);

function getErrorMessage(error: unknown) {
  const detail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) =>
        typeof item === 'object' && item && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : String(item)
      )
      .join(' ');
  }

  return (
    (error as { message?: string })?.message ||
    'Something went wrong. Please try again.'
  );
}

export function MeDevicesPage() {
  const queryClient = useQueryClient();
  const [showRequest, setShowRequest] = useState(false);

  const devicesQuery = useQuery({
    queryKey: ['me', 'devices'],
    queryFn: async (): Promise<MeDevice[]> => {
      try {
        const { data } = await api.get<MeDevice[]>('/me/devices');
        return data;
      } catch (error) {
        if ((error as { response?: { status?: number } })?.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
  });

  const requestsQuery = useQuery({
    queryKey: ['me', 'device-requests'],
    queryFn: () => deviceRequestService.listMine(),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => deviceRequestService.cancel(id),
    onSuccess: () => {
      toast.success('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['me', 'device-requests'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const devices = devicesQuery.data ?? [];
  const requests = requestsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Devices</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Company equipment assigned to you, and your equipment requests
          </p>
        </div>

        <button
          onClick={() => setShowRequest(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request equipment
        </button>
      </div>

      {devicesQuery.error && (
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-800">
            Could not load devices. Try refreshing.
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <Laptop
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            strokeWidth={1.5}
          />
          <p className="text-sm font-medium text-gray-700">
            No devices assigned
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Devices assigned to you will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const Icon =
              CATEGORY_ICONS[device.category.toLowerCase()] ?? Package;
            return (
              <div
                key={device.assignment_id}
                className="border border-gray-200 rounded-lg bg-white p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-gray-600" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-semibold text-gray-900 truncate">
                          {device.name}
                        </h3>
                        <div className="text-[11px] text-gray-500 mt-0.5 capitalize">
                          {device.category.replace(/_/g, ' ')}
                          {device.brand && ` · ${device.brand}`}
                          {device.model && ` ${device.model}`}
                        </div>
                      </div>
                      <ConditionBadge condition={device.condition} />
                    </div>

                    <div className="mt-3 space-y-1.5 text-[11px]">
                      {device.serial_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Serial</span>
                          <span className="text-gray-900 font-mono text-[10px]">
                            {device.serial_number}
                          </span>
                        </div>
                      )}
                      {device.assigned_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Assigned</span>
                          <span className="text-gray-900">
                            {format(new Date(device.assigned_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Requests */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">
            Equipment requests
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Your manager reviews the need, then HR arranges the equipment.
          </p>
        </div>

        {requestsQuery.isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            You have not requested any equipment yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map((request) => (
              <div
                key={request.id}
                className="px-5 py-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-gray-900 truncate">
                      {request.item_name}
                    </span>
                    <StatusPill status={request.status} />
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {request.request_number} ·{' '}
                    {request.category.replace(/_/g, ' ')}
                    {request.needed_by &&
                      ` · needed by ${format(
                        new Date(request.needed_by),
                        'MMM d, yyyy'
                      )}`}
                  </div>
                  <RequestProgress request={request} />
                  {request.rejection_reason && (
                    <p className="text-[11px] text-red-700 mt-1.5">
                      {request.rejection_reason}
                    </p>
                  )}
                </div>

                {OPEN_STATUSES.has(request.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(request.id)}
                    disabled={cancelMutation.isPending}
                    className="shrink-0 text-[11px] font-medium text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-800">
          Need to return a device or report damage? Contact HR.
        </div>
      </div>

      {showRequest && (
        <RequestDeviceModal
          onClose={() => setShowRequest(false)}
          onCreated={() => {
            setShowRequest(false);
            queryClient.invalidateQueries({
              queryKey: ['me', 'device-requests'],
            });
          }}
        />
      )}
    </div>
  );
}

function RequestProgress({ request }: { request: DeviceRequestRecord }) {
  if (request.status === 'fulfilled') {
    return (
      <p className="text-[11px] text-emerald-700 mt-1">
        {request.device_name
          ? `${request.device_name} assigned to you.`
          : 'Equipment assigned to you.'}
      </p>
    );
  }

  if (request.status === 'purchase_requested') {
    return (
      <p className="text-[11px] text-blue-700 mt-1">
        HR has ordered the equipment
        {request.purchase_reference
          ? ` (ref ${request.purchase_reference})`
          : ''}
        .
      </p>
    );
  }

  if (request.status === 'pending_fulfilment') {
    return (
      <p className="text-[11px] text-blue-700 mt-1">
        Approved — HR is arranging the equipment.
      </p>
    );
  }

  return null;
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

function RequestDeviceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<DeviceCategory>('laptop');
  const [itemName, setItemName] = useState('');
  const [justification, setJustification] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (itemName.trim().length < 3) {
        throw new Error('Describe the equipment in at least 3 characters.');
      }

      const record = await deviceRequestService.create({
        category,
        item_name: itemName.trim(),
        justification: justification.trim() || undefined,
        needed_by: neededBy || undefined,
      });

      return deviceRequestService.submit(record.id);
    },
    onSuccess: () => {
      toast.success('Equipment request submitted');
      onCreated();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={createMutation.isPending ? undefined : onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Request equipment
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Your manager approves the need, then HR arranges it.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={createMutation.isPending}
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

          <div>
            <span className="block text-xs font-medium text-gray-700 mb-1.5">
              What do you need?
            </span>
            <div className="grid grid-cols-3 gap-2">
              {REQUEST_CATEGORIES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={cn(
                    'px-2 py-2 rounded border text-xs font-medium transition-colors',
                    category === option.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Item
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="e.g. 24-inch monitor for the finance desk"
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Why do you need it?
            </label>
            <textarea
              rows={3}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              placeholder="Explain the work it supports."
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Needed by
            </label>
            <input
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  const styles: Record<string, string> = {
    new: 'bg-emerald-50 text-emerald-700',
    good: 'bg-emerald-50 text-emerald-700',
    fair: 'bg-amber-50 text-amber-700',
    poor: 'bg-red-50 text-red-700',
    retired: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0',
        styles[condition] ?? styles.good
      )}
    >
      {condition}
    </span>
  );
}

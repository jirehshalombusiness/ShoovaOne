import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Laptop, Smartphone, Tablet, Router, Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, any> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  router: Router,
  other: Package,
};

export function HRDevicesPage() {
  const { data: devices, isLoading } = useQuery({
    queryKey: ['hr', 'my-devices'],
    queryFn: () => hrService.getMyDevices(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Devices</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Company devices assigned to you
        </p>
      </div>

      {!devices || devices.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Laptop className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No devices assigned</p>
          <p className="text-xs text-gray-400 mt-1">
            Devices assigned to you by the organization will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((device) => {
            const Icon = CATEGORY_ICONS[device.category] || Package;
            return (
              <div
                key={device.assignment_id}
                className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors"
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
                          {device.category}
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

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-800">
          Need to return a device or report damage? Contact HR or IT.
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
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService, type ContractExpiryRow } from '@/services/hr.service';
import { FileWarning, CheckCircle2, ArrowRight, AlertCircle, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function ContractAlerts() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports', 'contracts-expiring'],
    queryFn: () => hrService.getContractsExpiring(),
    refetchInterval: 5 * 60_000,
  });

  const within30 = data?.within_30 ?? [];
  const within60 = (data?.within_60 ?? []).filter(
    (c) => !within30.find((x) => x.contract_id === c.contract_id),
  );

  const allAlerts = [...within30, ...within60];

  return (
    <div className="bg-white border border-gray-200 rounded-lg h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <FileWarning className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold text-gray-900">
            Contract Alerts
          </h3>
          {allAlerts.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
              {allAlerts.length}
            </span>
          )}
        </div>
        {allAlerts.length > 0 && (
          <button
            onClick={() => navigate('/hr/contracts')}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : allAlerts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2
                className="w-5 h-5 text-emerald-600"
                strokeWidth={1.75}
              />
            </div>
            <p className="text-sm font-medium text-gray-700">
              No contracts expiring
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Nothing within the next 60 days
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allAlerts.map((c) => (
              <ContractAlertRow
                key={c.contract_id}
                contract={c}
                onClick={() => navigate(`/hr/employees/${c.person_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ROW
// ============================================================

function ContractAlertRow({
  contract,
  onClick,
}: {
  contract: ContractExpiryRow;
  onClick: () => void;
}) {
  const days = differenceInDays(new Date(contract.end_date), new Date());

  const tone =
    days <= 14
      ? 'critical'
      : days <= 30
        ? 'warning'
        : 'info';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <div
        className={cn(
          'w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
          tone === 'critical' && 'bg-red-50',
          tone === 'warning' && 'bg-amber-50',
          tone === 'info' && 'bg-blue-50',
        )}
      >
        {tone === 'critical' ? (
          <AlertCircle className="w-4 h-4 text-red-600" strokeWidth={1.75} />
        ) : (
          <Clock
            className={cn(
              'w-4 h-4',
              tone === 'warning' && 'text-amber-600',
              tone === 'info' && 'text-blue-600',
            )}
            strokeWidth={1.75}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {contract.person_name}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
          {contract.position ?? contract.contract_type.replace(/_/g, ' ')}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'text-[10px] font-semibold',
              tone === 'critical' && 'text-red-600',
              tone === 'warning' && 'text-amber-600',
              tone === 'info' && 'text-blue-600',
            )}
          >
            {days} day{days !== 1 ? 's' : ''} left
          </span>
          <span className="text-[10px] text-gray-400">
            {format(new Date(contract.end_date), 'MMM d, yyyy')}
          </span>
        </div>
      </div>
    </button>
  );
}
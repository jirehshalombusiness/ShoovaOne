import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { EmployeeDetail } from '@/services/hr.service';

interface Props {
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  canEdit: boolean;
}

export function PersonHRContracts({ employee, isLoading }: Props) {
  if (isLoading) {
    return <LoadingCard />;
  }

  if (!employee || employee.contracts.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">No contracts on file</p>
      </div>
    );
  }

  const current = employee.contracts.find((c) => c.is_current);
  const history = employee.contracts.filter((c) => !c.is_current);

  return (
    <div className="space-y-4">
      {current && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-base font-semibold text-gray-900 capitalize">
              {current.contract_type.replace(/_/g, ' ')}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
              Current
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="Position" value={current.position ?? '—'} />
            <Stat label="Department" value={current.department ?? '—'} />
            <Stat label="Reports To" value={current.reports_to_name ?? '—'} />
            <Stat
              label="Start Date"
              value={format(new Date(current.start_date), 'MMM d, yyyy')}
            />
            {current.end_date && (
              <Stat
                label="End Date"
                value={format(new Date(current.end_date), 'MMM d, yyyy')}
              />
            )}
            {current.compensation_amount && (
              <Stat
                label="Compensation"
                value={`${current.compensation_currency} ${current.compensation_amount.toLocaleString()} / ${current.compensation_frequency}`}
              />
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            History ({history.length})
          </h3>
          <div className="space-y-3">
            {history.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-md">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900 capitalize">
                    {c.contract_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {format(new Date(c.start_date), 'MMM d, yyyy')}
                    {c.end_date && ` – ${format(new Date(c.end_date), 'MMM d, yyyy')}`}
                    {c.position && ` · ${c.position}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-[13px] text-gray-900">{value}</div>
    </div>
  );
}
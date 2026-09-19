import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import {
  FileSignature,
  Briefcase,
  Calendar,
  User,
  DollarSign,
  Download,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function HRContractPage() {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['hr', 'my-contracts'],
    queryFn: () => hrService.getMyContracts(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const current = contracts?.find((c) => c.is_current);
  const history = contracts?.filter((c) => !c.is_current) || [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Contract</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Employment details and contract history
        </p>
      </div>

      {!contracts || contracts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <FileSignature className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No contract on file</p>
          <p className="text-xs text-gray-400 mt-1">
            Contact HR to set up your employment contract
          </p>
        </div>
      ) : (
        <>
          {/* Current Contract */}
          {current && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileSignature className="w-6 h-6 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-gray-900">
                        {current.contract_type.replace(/_/g, ' ')}
                      </h2>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Started {format(new Date(current.start_date), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {current.document_id && (
                  <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-gray-100">
                <DetailItem
                  icon={Briefcase}
                  label="Position"
                  value={current.position || '—'}
                />
                <DetailItem
                  icon={Briefcase}
                  label="Department"
                  value={current.department || '—'}
                />
                <DetailItem
                  icon={User}
                  label="Reports To"
                  value={current.reports_to_name || '—'}
                />
                <DetailItem
                  icon={Calendar}
                  label="Start Date"
                  value={format(new Date(current.start_date), 'MMM d, yyyy')}
                />
                {current.end_date && (
                  <DetailItem
                    icon={Calendar}
                    label="End Date"
                    value={format(new Date(current.end_date), 'MMM d, yyyy')}
                  />
                )}
                {current.compensation_amount && (
                  <DetailItem
                    icon={DollarSign}
                    label="Compensation"
                    value={`${current.compensation_currency} ${current.compensation_amount.toLocaleString()} / ${current.compensation_frequency}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Contract History */}
          {history.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Contract History
              </h3>
              <div className="space-y-3">
                {history.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-3 p-3 rounded-md border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <FileSignature className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-900 capitalize">
                        {c.contract_type.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {format(new Date(c.start_date), 'MMM d, yyyy')}
                        {c.end_date &&
                          ` – ${format(new Date(c.end_date), 'MMM d, yyyy')}`}
                        {c.position && ` · ${c.position}`}
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-500 flex-shrink-0">
                      Ended
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <AlertCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-800">
          Questions about your contract? Contact HR.
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
          {label}
        </div>
        <div className="text-[13px] text-gray-900">{value}</div>
      </div>
    </div>
  );
}
import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { DollarSign, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface CompensationInfoProps {
  personId: string;
}

export function CompensationInfo({ personId }: CompensationInfoProps) {
  const { data: compensations, isLoading } = useQuery({
    queryKey: ['compensation', personId],
    queryFn: () => hrService.getCompensation(personId),
    enabled: !!personId,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (!compensations || compensations.length === 0) {
    return (
      <div className="text-center py-8">
        <DollarSign className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No compensation records</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {compensations.map((comp) => (
        <div key={comp.id} className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {comp.currency} {comp.base_salary.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                {comp.salary_frequency}
              </p>
              {comp.benefits && comp.benefits.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {comp.benefits.map((benefit) => (
                    <span key={benefit} className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                      {benefit}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Effective {format(new Date(comp.effective_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
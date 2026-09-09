import { useQuery } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { EmploymentRecord } from '@/types/hr.types';
import { Briefcase, Calendar, User, Building2, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface EmploymentHistoryProps {
  personId: string;
}

export function EmploymentHistory({ personId }: EmploymentHistoryProps) {
  const { data: employments, isLoading } = useQuery({
    queryKey: ['employment', personId],
    queryFn: () => hrService.getEmployment(personId),
    enabled: !!personId,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="h-12 w-12 bg-gray-200 rounded" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!employments || employments.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="h-8 w-8 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No employment records</p>
        <p className="text-sm text-gray-400 mt-1">Add employment information for this person</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Employment History</h4>
        <button className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark transition-colors">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <div className="space-y-3">
        {employments.map((employment) => (
          <div key={employment.id} className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{employment.position}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {employment.department}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {employment.employment_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(employment.start_date), 'MMM d, yyyy')}
                    {employment.end_date && ` - ${format(new Date(employment.end_date), 'MMM d, yyyy')}`}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    employment.status === 'active' ? 'bg-green-100 text-green-700' :
                    employment.status === 'on_leave' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {employment.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
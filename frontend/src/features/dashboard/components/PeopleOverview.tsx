import { useQuery } from '@tanstack/react-query';
import { peopleService } from '@/services/people';
import { Users, UserPlus, UserCheck, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PeopleOverview() {
  const navigate = useNavigate();
  const { data: people, isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: () => peopleService.getAll({ limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-16 bg-gray-200 rounded" />
          <div className="space-y-2">
            <div className="h-3 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const totalPeople = people?.length || 0;
  const staffCount = people?.filter(p => p.type === 'staff').length || 0;
  const volunteerCount = people?.filter(p => p.type === 'volunteer').length || 0;
  const beneficiaryCount = people?.filter(p => p.type === 'beneficiary').length || 0;
  const externalCount = people?.filter(p => p.type === 'external_contact').length || 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">People</h3>
        <button onClick={() => navigate('/people')} className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1">
          View People
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <p className="text-3xl font-bold text-gray-900">{totalPeople}</p>
        <p className="text-sm text-gray-500 mb-0.5">total</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <UserCheck className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-700">{staffCount}</p>
            <p className="text-[10px] text-gray-400">Staff</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <UserPlus className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-700">{volunteerCount}</p>
            <p className="text-[10px] text-gray-400">Volunteers</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <Users className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-700">{beneficiaryCount}</p>
            <p className="text-[10px] text-gray-400">Beneficiaries</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <Building2 className="h-4 w-4 text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-700">{externalCount}</p>
            <p className="text-[10px] text-gray-400">External</p>
          </div>
        </div>
      </div>

      {/* Recently added people - show last 3 */}
      {people && people.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
            Recently added
          </p>
          <div className="space-y-1.5">
            {people.slice(0, 3).map((person) => (
              <div key={person.id} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
                  {person.first_name?.[0]}{person.last_name?.[0]}
                </div>
                <span className="text-gray-700">{person.first_name} {person.last_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
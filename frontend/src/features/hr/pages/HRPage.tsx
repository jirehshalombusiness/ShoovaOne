import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Briefcase, Lock, User } from 'lucide-react';
import { peopleService } from '@/services/people.service';

export function HRPage() {
  const { data: people = [], isLoading, isError } = useQuery({
    queryKey: ['hr-people'],
    queryFn: () => peopleService.getAll({ type: 'staff', limit: 100 }),
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Human Resources</h1>
          <span className="flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700">
            <Lock className="h-3 w-3" /> Confidential
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Select a staff member to view their protected HR record.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Salary, bank details, performance information, leave, and employment records are restricted to authorized HR users.
      </div>

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load staff records. Please try again.
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : people.length === 0 ? (
          <div className="py-12 text-center">
            <Briefcase className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No staff records found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {people.map((person) => (
              <Link key={person.id} to={`/people/${person.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {person.first_name?.[0]}{person.last_name?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{person.first_name} {person.last_name}</p>
                  <p className="text-sm text-gray-500">{person.email || 'No email recorded'}</p>
                </div>
                <User className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

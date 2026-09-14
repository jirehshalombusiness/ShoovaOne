import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { Search, Users, Briefcase, MapPin, Mail, ChevronRight } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export function EmployeesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: employees, isLoading } = useQuery({
    queryKey: ['hr', 'employees', debouncedSearch, typeFilter],
    queryFn: () =>
      hrService.getEmployees({
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
      }),
  });

  const stats = useMemo(() => {
    if (!employees) return { total: 0, staff: 0, volunteers: 0 };
    return {
      total: employees.length,
      staff: employees.filter((e) => e.type === 'staff').length,
      volunteers: employees.filter((e) => e.type === 'volunteer').length,
    };
  }, [employees]);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats.total} people · {stats.staff} staff · {stats.volunteers} volunteers
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'staff', label: 'Staff' },
            { value: 'volunteer', label: 'Volunteers' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                typeFilter === f.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !employees || employees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No employees found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={() => navigate(`/hr/employees/${emp.id}`)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
            >
              <Avatar
                firstName={emp.first_name}
                lastName={emp.last_name}
                imageUrl={emp.profile_image_url}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold text-gray-900 truncate">
                    {emp.first_name} {emp.last_name}
                  </div>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
                      emp.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {emp.status || 'active'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                  {emp.job_title && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-2.5 h-2.5" />
                      {emp.job_title}
                    </span>
                  )}
                  {emp.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {emp.location}
                    </span>
                  )}
                  {emp.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" />
                      {emp.email}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
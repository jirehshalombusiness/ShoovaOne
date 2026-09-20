import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  UserPlus,
  ChevronRight,
  MapPin,
  Briefcase,
  Mail,
  Filter,
} from 'lucide-react';
import { hrService, type EmployeeListItem } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

export function HREmployeesPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: [
      'hr',
      'employees',
      debouncedSearch,
      typeFilter,
      statusFilter,
      departmentFilter,
    ],
    queryFn: () =>
      hrService.listEmployees({
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        department: departmentFilter || undefined,
        limit: 500,
      }),
  });

  const statsQuery = useQuery({
    queryKey: ['hr', 'employees', 'stats'],
    queryFn: () => hrService.getEmployeeStats(),
  });

  const employees = data?.items ?? [];
  const stats = statsQuery.data;

  const departments = useMemo(() => {
    if (!stats?.by_department) return [];
    return Object.keys(stats.by_department).sort();
  }, [stats]);

  const hasFilters =
    typeFilter || statusFilter || departmentFilter || search.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Employees</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {stats ? (
              <>
                {stats.active} active · {stats.total} total
                {Object.keys(stats.by_type).length > 0 && (
                  <>
                    {' · '}
                    {Object.entries(stats.by_type)
                      .slice(0, 3)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(', ')}
                  </>
                )}
              </>
            ) : (
              'Loading…'
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/people/new')}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Person to Directory
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or employee #…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All types</option>
            <option value="staff">Staff</option>
            <option value="volunteer">Volunteers</option>
            <option value="beneficiary">Beneficiaries</option>
            <option value="external_contact">External</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>

          {/* Department */}
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('');
                setStatusFilter('');
                setDepartmentFilter('');
              }}
              className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          {employees.length} result{employees.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="border border-gray-200 rounded-lg bg-white text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            {hasFilters ? 'No employees match your filters' : 'No employees yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {hasFilters
              ? 'Try adjusting or clearing your filters'
              : 'Add your first employee to get started'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* Table head */}
          <div className="hidden lg:grid grid-cols-[minmax(280px,2fr)_minmax(200px,1.5fr)_minmax(180px,1fr)_minmax(140px,1fr)_40px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            <div>Employee</div>
            <div>Position</div>
            <div>Contact</div>
            <div>Reports To</div>
            <div />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {employees.map((emp) => (
              <EmployeeRow key={emp.id} employee={emp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EMPLOYEE ROW
// ============================================================

function EmployeeRow({ employee }: { employee: EmployeeListItem }) {
  const navigate = useNavigate();

  const initials = `${employee.first_name?.[0] ?? ''}${employee.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <button
      onClick={() => navigate(`/hr/employees/${employee.id}`)}
      className="w-full grid grid-cols-1 lg:grid-cols-[minmax(280px,2fr)_minmax(200px,1.5fr)_minmax(180px,1fr)_minmax(140px,1fr)_40px] gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left items-center"
    >
      {/* Column 1 — Name + avatar */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          firstName={employee.first_name}
          lastName={employee.last_name}
          imageUrl={employee.profile_image_url}
          size="md"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-gray-900 truncate">
              {employee.first_name} {employee.last_name}
            </span>
            {employee.status === 'active' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Active" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
            <span className="capitalize">{employee.type}</span>
            {employee.employee_number && (
              <>
                <span>·</span>
                <span className="font-mono">{employee.employee_number}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Column 2 — Position */}
      <div className="min-w-0">
        {employee.job_title ? (
          <div className="flex items-center gap-1.5 text-[13px] text-gray-700">
            <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{employee.job_title}</span>
          </div>
        ) : (
          <span className="text-[12px] text-gray-400">—</span>
        )}
        {employee.department && (
          <div className="text-[11px] text-gray-500 mt-0.5">
            {employee.department}
          </div>
        )}
      </div>

      {/* Column 3 — Contact */}
      <div className="min-w-0">
        {employee.email ? (
          <div className="flex items-center gap-1.5 text-[12px] text-gray-600">
            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{employee.email}</span>
          </div>
        ) : (
          <span className="text-[12px] text-gray-400">No email</span>
        )}
        {employee.location && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{employee.location}</span>
          </div>
        )}
      </div>

      {/* Column 4 — Reports To */}
      <div className="min-w-0">
        {employee.reports_to_name ? (
          <span className="text-[12px] text-gray-700 truncate block">
            {employee.reports_to_name}
          </span>
        ) : (
          <span className="text-[12px] text-gray-400">—</span>
        )}
      </div>

      {/* Column 5 — Chevron */}
      <div className="hidden lg:flex items-center justify-end">
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </button>
  );
}
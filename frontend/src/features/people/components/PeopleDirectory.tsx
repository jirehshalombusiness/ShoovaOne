import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { peopleService, PeopleFilters } from '@/services/people.service';
import { Person } from '@/types/person.types';
import { Search, Filter, Plus, User, Mail, Phone, Building2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/lib/auth';

interface PeopleDirectoryProps {
  onSelectPerson?: (person: Person) => void;
  onAddPerson?: () => void;
}

export function PeopleDirectory({ onSelectPerson, onAddPerson }: PeopleDirectoryProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PeopleFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: people, isLoading, isError } = useQuery({
    queryKey: ['people', debouncedSearch, filters],
    queryFn: () => peopleService.getAll({
      search: debouncedSearch || undefined,
      limit: 100,
      ...filters,
    }),
  });

  const stats = useMemo(() => {
    if (!people) return { total: 0, staff: 0, volunteers: 0, beneficiaries: 0, external: 0 };
    return {
      total: people.length,
      staff: people.filter(p => p.type === 'staff').length,
      volunteers: people.filter(p => p.type === 'volunteer').length,
      beneficiaries: people.filter(p => p.type === 'beneficiary').length,
      external: people.filter(p => p.type === 'external_contact').length,
    };
  }, [people]);

  const handleRowClick = (person: Person) => {
    if (onSelectPerson) {
      onSelectPerson(person);
    } else {
      navigate(`/people/${person.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-200 rounded-lg w-full" />
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500">Staff</p>
          <p className="text-xl font-bold text-gray-900">{stats.staff}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500">Volunteers</p>
          <p className="text-xl font-bold text-gray-900">{stats.volunteers}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500">Beneficiaries</p>
          <p className="text-xl font-bold text-gray-900">{stats.beneficiaries}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500">External</p>
          <p className="text-xl font-bold text-gray-900">{stats.external}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, organization..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>
        {user?.permissions.includes('people.create') && (
          <button
            onClick={onAddPerson}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Person
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type || ''}
              onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined })}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Types</option>
              <option value="staff">Staff</option>
              <option value="volunteer">Volunteer</option>
              <option value="beneficiary">Beneficiary</option>
              <option value="external_contact">External Contact</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({})}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load people right now. Check your access and try again.
        </div>
      )}

      {/* People List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {people?.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No people found</p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? 'Try adjusting your search or filters' : 'Add your first person to get started'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {people?.map((person) => (
              <div
                key={person.id}
                onClick={() => handleRowClick(person)}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {person.first_name?.[0]}{person.last_name?.[0]}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">
                        {person.first_name} {person.last_name}
                      </p>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        person.status === 'active' ? 'bg-green-100 text-green-700' :
                        person.status === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {person.status || 'Active'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {person.email || 'No email'}
                      </span>
                      {person.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {person.phone}
                        </span>
                      )}
                      {person.organization && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {person.organization}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">{person.type}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
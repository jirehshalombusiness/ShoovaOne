import { Person } from '@/types/person.types';
import { Calendar, Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface PersonOverviewProps {
  person: Person;
}

export function PersonOverview({ person }: PersonOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Contact Information */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {person.email && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{person.email}</p>
              </div>
            </div>
          )}
          {person.phone && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm text-gray-900">{person.phone}</p>
              </div>
            </div>
          )}
          {(person.address || person.city || person.country) && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm text-gray-900">
                  {[person.address, person.city, person.state, person.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Organizational Information */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Organizational Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {person.role && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Role</p>
                <p className="text-sm text-gray-900">{person.role}</p>
              </div>
            </div>
          )}
          {person.department && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm text-gray-900">{person.department}</p>
              </div>
            </div>
          )}
          {person.start_date && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Start Date</p>
                <p className="text-sm text-gray-900">
                  {format(new Date(person.start_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {person.notes && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Notes</h4>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
import { Person } from '@/types/person.types';
import { Calendar, User, Mail, Phone, MapPin, Briefcase } from 'lucide-react';
import { format } from 'date-fns';

interface PersonOverviewProps {
  person: Person;
}

export function PersonOverview({ person }: PersonOverviewProps) {
  const hasContact =
    person.email ||
    person.phone ||
    person.address ||
    person.city ||
    person.country;

  const hasOrg =
    person.job_title ||
    person.department ||
    person.location ||
    person.employment_type;

  return (
    <div className="space-y-6">
      {hasContact && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Contact Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {person.email && (
              <InfoBlock icon={Mail} label="Email" value={person.email} />
            )}
            {person.phone && (
              <InfoBlock icon={Phone} label="Phone" value={person.phone} />
            )}
            {(person.address || person.city || person.country) && (
              <div className="md:col-span-2">
                <InfoBlock
                  icon={MapPin}
                  label="Address"
                  value={[person.address, person.city, person.state, person.country]
                    .filter(Boolean)
                    .join(', ')}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {hasOrg && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Organisational Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {person.job_title && (
              <InfoBlock icon={Briefcase} label="Job Title" value={person.job_title} />
            )}
            {person.department && (
              <InfoBlock icon={User} label="Department" value={person.department} />
            )}
            {person.location && (
              <InfoBlock icon={MapPin} label="Location" value={person.location} />
            )}
            {person.employment_type && (
              <InfoBlock
                icon={Briefcase}
                label="Employment Type"
                value={person.employment_type.replace(/_/g, ' ')}
              />
            )}
          </div>
        </div>
      )}

      {person.date_of_birth && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">
            Personal
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoBlock
              icon={Calendar}
              label="Date of Birth"
              value={format(new Date(person.date_of_birth), 'MMMM d, yyyy')}
            />
            {person.gender && (
              <InfoBlock icon={User} label="Gender" value={person.gender} />
            )}
          </div>
        </div>
      )}

      {person.bio && (
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">About</h4>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{person.bio}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}
import { Person } from '@/types/person.types';
import { Avatar } from '@/components/ui/Avatar';
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  Edit,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

interface PersonProfileHeaderProps {
  person: Person;
  onEdit?: () => void;
}

export function PersonProfileHeader({ person, onEdit }: PersonProfileHeaderProps) {
  const { hasPermission } = usePermissions();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'inactive': return 'text-yellow-600 bg-yellow-50';
      case 'archived': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-start gap-6">
        {/* Avatar */}
        <Avatar
          firstName={person.first_name}
          lastName={person.last_name}
          imageUrl={person.profile_image_url}
          size="2xl"
          className="ring-2 ring-gray-100"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900">
                  {person.first_name} {person.last_name}
                </h2>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(person.status || 'active')}`}>
                  {person.status || 'Active'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded capitalize">
                  {person.type || 'Staff'}
                </span>
                {person.job_title && (
                  <span className="font-medium text-gray-700">{person.job_title}</span>
                )}
                {person.location && (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    {person.location}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
             {onEdit && hasPermission('people.edit') && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
              )}
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 text-sm">
            {person.email && (
              <span className="flex items-center gap-1.5 text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${person.email}`} className="hover:text-primary transition-colors">
                  {person.email}
                </a>
              </span>
            )}
            {person.phone && (
              <span className="flex items-center gap-1.5 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" />
                <a href={`tel:${person.phone}`} className="hover:text-primary transition-colors">
                  {person.phone}
                </a>
              </span>
            )}
            {person.created_at && (
              <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                <Calendar className="h-3 w-3" />
                Member since {format(new Date(person.created_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
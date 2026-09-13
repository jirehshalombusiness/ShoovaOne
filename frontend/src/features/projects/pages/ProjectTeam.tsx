import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectService, Project, ProjectMember } from '@/services/project.service';
import { peopleService } from '@/services/people.service';
import { usePermissions } from '@/hooks/usePermissions';
import { Avatar } from '@/components/ui/Avatar';
import {
  UserPlus,
  Users,
  X,
  Crown,
  User as UserIcon,
  Trash2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const ROLES = [
  { value: 'manager', label: 'Manager', icon: Crown, color: 'bg-amber-50 text-amber-700' },
  { value: 'member', label: 'Member', icon: UserIcon, color: 'bg-gray-100 text-gray-700' },
  { value: 'contributor', label: 'Contributor', icon: UserIcon, color: 'bg-blue-50 text-blue-700' },
  { value: 'viewer', label: 'Viewer', icon: UserIcon, color: 'bg-gray-100 text-gray-500' },
];

export function ProjectTeam() {
  const { project } = useOutletContext<{ project: Project }>();
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [showAddModal, setShowAddModal] = useState(false);

  const canEdit = hasPermission('projects.edit');
  const members = project.members || [];

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => projectService.removeMember(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">
            {members.length} {members.length === 1 ? 'member' : 'members'} on this project
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {/* Members Grid */}
      {members.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No team members yet</p>
          <p className="text-xs text-gray-400 mt-1">Add people to start collaborating</p>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-xs font-medium hover:bg-primary-dark transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add First Member
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((member) => {
            const roleConfig = ROLES.find((r) => r.value === member.role) || ROLES[1];
            const RoleIcon = roleConfig.icon;
            return (
              <div
                key={member.id}
                className="bg-white border border-gray-200 rounded-lg p-4 group hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar
                      firstName={member.first_name}
                      lastName={member.last_name}
                      imageUrl={member.profile_image_url}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {member.first_name} {member.last_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
                            roleConfig.color
                          )}
                        >
                          <RoleIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                          {roleConfig.label}
                        </span>
                        {member.joined_at && (
                          <span className="text-[10px] text-gray-400">
                            Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canEdit && member.role !== 'manager' && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${member.first_name} from this project?`)) {
                          removeMutation.mutate(member.id);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from project"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          projectId={projectId!}
          existingPersonIds={members.map((m) => m.person_id)}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function AddMemberModal({
  projectId,
  existingPersonIds,
  onClose,
}: {
  projectId: string;
  existingPersonIds: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [role, setRole] = useState('member');

  const { data: people, isLoading } = useQuery({
    queryKey: ['people', 'for-team-picker'],
    queryFn: () => peopleService.getAll({ limit: 200 }),
  });

  // Filter out people already on the project
  const availablePeople = (people || []).filter(
    (p) => !existingPersonIds.includes(p.id)
  );

  const filteredPeople = search
    ? availablePeople.filter((p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
      )
    : availablePeople;

  const addMutation = useMutation({
    mutationFn: () => projectService.addMember(projectId, selectedPersonId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Member added');
      onClose();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.detail || 'Failed to add member'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersonId) {
      toast.error('Please select a person');
      return;
    }
    addMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Add Team Member</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Search People
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Select Person
              </label>
              <div className="max-h-[240px] overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                {isLoading ? (
                  <div className="p-4 text-center text-xs text-gray-500">Loading...</div>
                ) : filteredPeople.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    {search ? 'No matching people' : 'All people are already on this project'}
                  </div>
                ) : (
                  filteredPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedPersonId(person.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                        selectedPersonId === person.id
                          ? 'bg-primary/5 border-l-2 border-primary'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <Avatar
                        firstName={person.first_name}
                        lastName={person.last_name}
                        imageUrl={person.profile_image_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {person.first_name} {person.last_name}
                        </div>
                        {person.job_title && (
                          <div className="text-[10px] text-gray-500 truncate">
                            {person.job_title}
                          </div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || !selectedPersonId}
              className="px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {addMutation.isPending ? 'Adding...' : 'Add to Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
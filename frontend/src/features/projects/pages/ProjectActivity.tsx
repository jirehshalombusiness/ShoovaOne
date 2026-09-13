import { useOutletContext, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService, Project, ActivityItem } from '@/services/project.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  Activity,
  Plus,
  Edit,
  UserPlus,
  Target,
  Trash2,
  FileText,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

function getActionIcon(action: string) {
  switch (action) {
    case 'created': return Plus;
    case 'updated': return Edit;
    case 'deleted': return Trash2;
    case 'member_added': return UserPlus;
    case 'milestone_created': return Target;
    case 'completed': return CheckCircle;
    default: return Activity;
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'created': return 'bg-emerald-50 text-emerald-600';
    case 'updated': return 'bg-blue-50 text-blue-600';
    case 'deleted': return 'bg-red-50 text-red-600';
    case 'member_added': return 'bg-purple-50 text-purple-600';
    case 'milestone_created': return 'bg-amber-50 text-amber-600';
    case 'completed': return 'bg-emerald-50 text-emerald-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function humanizeAction(action: string, metadata: any): string {
  const actor = metadata?.actor_name || '';
  switch (action) {
    case 'created':
      return `created the project`;
    case 'updated':
      return `updated the project details`;
    case 'deleted':
      return `deleted the project`;
    case 'member_added':
      return `added ${metadata?.member_name || 'a member'} to the team`;
    case 'member_removed':
      return `removed ${metadata?.member_name || 'a member'} from the team`;
    case 'milestone_created':
      return `added milestone "${metadata?.title || ''}"`;
    case 'milestone_completed':
      return `completed milestone "${metadata?.title || ''}"`;
    case 'task_created':
      return `created task "${metadata?.title || ''}"`;
    case 'task_completed':
      return `completed task "${metadata?.title || ''}"`;
    default:
      return action.replace(/_/g, ' ');
  }
}

export function ProjectActivity() {
  const { project } = useOutletContext<{ project: Project }>();
  const { id: projectId } = useParams<{ id: string }>();

  const { data: activity, isLoading } = useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: () => projectService.getActivity(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Activity</h1>
        <p className="text-sm text-gray-500 mt-1">
          Recent updates to {project.name}
        </p>
      </div>

      {!activity || activity.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">No activity yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Changes to the project will appear here
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100" />

            <div className="space-y-5">
              {activity.map((item) => {
                const Icon = getActionIcon(item.action);
                const colorClass = getActionColor(item.action);
                const description = humanizeAction(item.action, item.metadata);

                return (
                  <div key={item.id} className="relative flex gap-4">
                    <div
                      className={cn(
                        'relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white',
                        colorClass
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                    </div>

                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Avatar
                          firstName={item.actor_first_name}
                          lastName={item.actor_last_name}
                          imageUrl={item.actor_image_url}
                          size="xs"
                        />
                        <span className="text-sm font-semibold text-gray-900">
                          {item.actor_first_name} {item.actor_last_name}
                        </span>
                        <span className="text-sm text-gray-600">{description}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                        <Clock className="w-2.5 h-2.5" />
                        {item.created_at && (
                          <>
                            {format(new Date(item.created_at), 'MMM d, yyyy')}
                            {' · '}
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
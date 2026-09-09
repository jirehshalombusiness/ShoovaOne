import { Clock } from 'lucide-react';

interface PersonActivityProps {
  personId: string;
}

export function PersonActivity({ personId }: PersonActivityProps) {
  return (
    <div className="text-center py-8">
      <Clock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500 text-sm">Activity tracking is not available yet</p>
      <p className="text-gray-400 text-xs mt-1">Updates will appear here when the activity service is connected.</p>
    </div>
  );
}
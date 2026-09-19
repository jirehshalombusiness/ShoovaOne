import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrService } from '@/services/hr.service';
import { Avatar } from '@/components/ui/Avatar';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Inbox,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';

export function HRLeaveRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  // This uses the existing /hr/employees endpoint indirectly
  // In a real setup, we'd have a dedicated /hr/leave-requests endpoint
  const { data: requests, isLoading } = useQuery({
    queryKey: ['hr', 'all-leave-requests', statusFilter],
    queryFn: async () => {
      // Placeholder — the actual endpoint should list all pending requests
      // For now returns empty; you'd build a proper endpoint
      return [] as any[];
    },
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Review and approve time-off requests from your team
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {[
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : !requests || requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-700">
            No {statusFilter !== 'all' ? statusFilter : ''} requests
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Requests from your team will appear here
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {requests.map((req: any) => (
            <div key={req.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar
                  firstName={req.first_name}
                  lastName={req.last_name}
                  imageUrl={req.profile_image_url}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">
                    {req.first_name} {req.last_name}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {req.leave_type_name} · {req.total_days} days
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    {format(new Date(req.start_date), 'MMM d')} –{' '}
                    {format(new Date(req.end_date), 'MMM d, yyyy')}
                  </div>
                  {req.reason && (
                    <div className="text-[11px] text-gray-600 mt-2 p-2 bg-gray-50 rounded-md">
                      {req.reason}
                    </div>
                  )}
                </div>
                {req.status === 'pending' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
        <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-amber-800">
          Approving or rejecting a request requires a backend endpoint
          (<code className="bg-amber-100 px-1 rounded">/hr/leave-requests</code>).
          This page is a placeholder for the UI.
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';
import { peopleService } from '@/services/people';
import { useAuth } from '@/lib/auth';
import { Clock, LogIn, LogOut, Calendar, User, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export function AttendancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Get today's attendance
  const { data: todayAttendance, refetch } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: attendanceService.getToday,
  });

  // Get all people for the attendance list
  const { data: people } = useQuery({
    queryKey: ['people'],
    queryFn: () => peopleService.getAll(),
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: attendanceService.checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      refetch();
      toast.success('✅ Checked in successfully!');
    },
    onError: () => toast.error('Failed to check in'),
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: attendanceService.checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      refetch();
      toast.success('✅ Checked out successfully!');
    },
    onError: () => toast.error('Failed to check out'),
  });

  const isCheckedIn = todayAttendance && !todayAttendance.check_out;
  const isCheckedOut = todayAttendance && todayAttendance.check_out;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Attendance</h1>
          <p className="text-sm text-muted">Track your daily attendance</p>
        </div>
        <div className="text-sm text-muted">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </div>
      </div>

      {/* Today's Status */}
      <div className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-soft flex items-center justify-center">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-text">Today's Status</h3>
              {isCheckedOut ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Completed
                </p>
              ) : isCheckedIn ? (
                <p className="text-sm text-blue-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" /> Checked In
                </p>
              ) : (
                <p className="text-sm text-muted">Not checked in yet</p>
              )}
              {todayAttendance && (
                <div className="text-xs text-muted mt-1">
                  {todayAttendance.check_in && `In: ${format(new Date(todayAttendance.check_in), 'h:mm a')}`}
                  {todayAttendance.check_out && ` | Out: ${format(new Date(todayAttendance.check_out), 'h:mm a')}`}
                  {todayAttendance.duration_minutes && ` | ${Math.floor(todayAttendance.duration_minutes / 60)}h ${todayAttendance.duration_minutes % 60}m`}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {!isCheckedIn && !isCheckedOut && (
              <button
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {checkInMutation.isPending ? 'Checking in...' : 'Check In'}
              </button>
            )}
            {isCheckedIn && !isCheckedOut && (
              <button
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {checkOutMutation.isPending ? 'Checking out...' : 'Check Out'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-muted">Total Staff</div>
          <div className="text-2xl font-bold text-text">{people?.length || 0}</div>
        </div>
        <div className="card p-4 border-green-200 bg-green-50">
          <div className="text-sm text-green-700">Checked In Today</div>
          <div className="text-2xl font-bold text-green-700">
            {todayAttendance ? 1 : 0}
          </div>
        </div>
        <div className="card p-4 border-yellow-200 bg-yellow-50">
          <div className="text-sm text-yellow-700">Pending Checkout</div>
          <div className="text-2xl font-bold text-yellow-700">
            {isCheckedIn && !isCheckedOut ? 1 : 0}
          </div>
        </div>
      </div>

      {/* Recent Attendance */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">Today's Activity</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 border border-border rounded-md text-sm"
            />
          </div>
        </div>

        <div className="divide-y divide-border">
          {todayAttendance ? (
            <div className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-muted">
                    {todayAttendance.check_in && `Checked in at ${format(new Date(todayAttendance.check_in), 'h:mm a')}`}
                    {todayAttendance.check_out && ` | Checked out at ${format(new Date(todayAttendance.check_out), 'h:mm a')}`}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded ${
                todayAttendance.status === 'present' ? 'bg-green-100 text-green-700' :
                todayAttendance.status === 'absent' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {todayAttendance.status}
              </span>
            </div>
          ) : (
            <div className="text-center py-8 text-muted text-sm">
              No attendance records for today
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
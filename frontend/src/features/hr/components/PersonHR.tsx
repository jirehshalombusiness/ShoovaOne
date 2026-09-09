import { ShieldAlert, Lock } from 'lucide-react';

interface PersonHRProps {
  personId: string;
}

export function PersonHR({ personId }: PersonHRProps) {
  void personId;

  return (
    <div className="space-y-6">
      {/* Confidential Notice */}
      <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <Lock className="h-4 w-4 text-yellow-600" />
        <p className="text-sm text-yellow-700">
          This information is confidential and should only be accessed by authorized personnel.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-blue-600" />
        <h3 className="text-sm font-semibold text-blue-900">HR records are not connected yet</h3>
        <p className="mx-auto mt-1 max-w-lg text-sm text-blue-800">
          The confidential HR interface is in place, but employment, compensation, leave, performance, and document
          storage require their protected backend services before records can be shown or changed.
        </p>
      </div>
    </div>
  );
}
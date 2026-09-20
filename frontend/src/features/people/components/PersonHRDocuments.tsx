import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { EmployeeDetail } from '@/services/hr.service';
import { cn } from '@/lib/utils';

interface Props {
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  canVerify: boolean;
}

export function PersonHRDocuments({ employee, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-100 rounded animate-pulse mb-3" />
        ))}
      </div>
    );
  }

  if (!employee || employee.documents.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">No documents on file</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
      {employee.documents.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
          <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-900 hover:text-primary transition-colors truncate block"
            >
              {doc.name}
            </a>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {doc.created_at && format(new Date(doc.created_at), 'MMM d, yyyy')}
              {doc.expiry_date && ` · expires ${format(new Date(doc.expiry_date), 'MMM d, yyyy')}`}
            </div>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider flex-shrink-0',
              doc.verified
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {doc.verified ? 'Verified' : 'Pending'}
          </span>
        </div>
      ))}
    </div>
  );
}
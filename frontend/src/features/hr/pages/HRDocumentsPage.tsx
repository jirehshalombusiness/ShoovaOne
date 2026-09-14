import { FileText } from 'lucide-react';

export function HRDocumentsPage() {
  return (
    <div className="text-center py-16">
      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">Compliance Documents</p>
      <p className="text-xs text-gray-400 mt-1">
        Required documents, expiry tracking, and verification
      </p>
    </div>
  );
}
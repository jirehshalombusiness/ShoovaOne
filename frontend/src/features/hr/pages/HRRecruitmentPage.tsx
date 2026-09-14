import { Briefcase } from 'lucide-react';

export function HRRecruitmentPage() {
  return (
    <div className="text-center py-16">
      <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-700">Recruitment</p>
      <p className="text-xs text-gray-400 mt-1">
        Job posts, applications, and hiring pipeline — coming soon
      </p>
    </div>
  );
}
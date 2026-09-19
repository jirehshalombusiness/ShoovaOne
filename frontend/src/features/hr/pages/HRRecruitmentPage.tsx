import { Briefcase, Plus } from 'lucide-react';

export function HRRecruitmentPage() {
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recruitment</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Job posts, applications, and hiring pipeline
          </p>
        </div>
        <button className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors">
          <Plus className="w-4 h-4" />
          New Job Post
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg text-center py-16">
        <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-gray-700">Coming soon</p>
        <p className="text-xs text-gray-400 mt-1">
          Job postings, applicant tracking, and interview scheduling will appear here
        </p>
      </div>
    </div>
  );
}
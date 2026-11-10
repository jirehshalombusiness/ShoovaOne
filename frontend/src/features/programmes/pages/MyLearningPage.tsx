import { LearnerCourseworkList } from '../components/LearnerCourseworkList';

export function MyLearningPage() {
  return (
    <div className="max-w-5xl space-y-5">
      <div><h1 className="text-2xl font-bold text-gray-900">My Learning</h1><p className="text-sm text-gray-500 mt-1">Your course assignments, submissions, scores and feedback</p></div>
      <LearnerCourseworkList />
    </div>
  );
}

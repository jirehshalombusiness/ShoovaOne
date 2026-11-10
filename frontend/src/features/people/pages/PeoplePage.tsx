import { PeopleDirectory } from '../components/PeopleDirectory';

export function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Browse staff, partner contacts, volunteers, and programme-enrolled students. Search and filter the full directory.
        </p>
      </div>
      <PeopleDirectory />
    </div>
  );
}

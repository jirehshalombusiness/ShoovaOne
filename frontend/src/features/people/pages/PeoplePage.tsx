import { PeopleDirectory } from '../components/PeopleDirectory';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { peopleService } from '@/services/people.service';
import { X } from 'lucide-react';

export function PeoplePage() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    first_name: string;
    last_name: string;
    email: string;
    type: 'staff' | 'volunteer' | 'beneficiary' | 'external_contact';
  }>({ first_name: '', last_name: '', email: '', type: 'staff' });

 const createPerson = useMutation({
  mutationFn: () => peopleService.create({
    ...form,
    email: form.email || null,
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['people'] });
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      type: 'staff',
    });
    setShowCreate(false);
  },
});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage the people connected to SHOOVA and view their organizational relationships, activities and participation.
        </p>
      </div>
      <PeopleDirectory onAddPerson={() => setShowCreate(true)} />
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add person</h2>
                <p className="mt-1 text-sm text-gray-500">Create a central identity record for someone connected to SHOOVA.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                createPerson.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <input required placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <input required placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <input type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="staff">Staff</option>
                <option value="volunteer">Volunteer</option>
                <option value="beneficiary">Beneficiary</option>
                <option value="external_contact">External contact</option>
              </select>
              {createPerson.isError && <p className="text-sm text-red-600">Unable to create this person. Check the details and try again.</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700">Cancel</button>
                <button type="submit" disabled={createPerson.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {createPerson.isPending ? 'Creating...' : 'Create person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
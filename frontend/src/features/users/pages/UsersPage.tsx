import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { peopleService } from '@/services/people.service';
import { usersService } from '@/services/users';

const roles = ['ceo', 'executive_director', 'director', 'manager', 'staff', 'volunteer', 'external_partner'];

export function UsersPage() {
  const queryClient = useQueryClient();
  const [personId, setPersonId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [message, setMessage] = useState('');
  const users = useQuery({ queryKey: ['users'], queryFn: usersService.getAll });
  const people = useQuery({ queryKey: ['people', 'user-provisioning'], queryFn: () => peopleService.getAll({ limit: 100 }) });
  const create = useMutation({
    mutationFn: () => usersService.create(personId, password, [role]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPersonId('');
      setPassword('');
      setMessage('Login access created.');
    },
    onError: () => setMessage('Unable to create login access. Confirm the person has an email and does not already have an account.'),
  });
  const toggle = useMutation({
    mutationFn: (user: { id: string; is_active: boolean }) => usersService.update(user.id, { is_active: !user.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User access</h1>
        <p className="mt-1 text-sm text-gray-500">Create and control login access for existing People records. Passwords are never displayed.</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900"><KeyRound className="h-4 w-4 text-primary" />Grant login access</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Select a person</option>
            {people.data?.filter((person) => person.email).map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name} ({person.email})</option>)}
          </select>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            {roles.map((item) => <option key={item} value={item}>{item.replace('_', ' ')}</option>)}
          </select>
          <button disabled={!personId || !password || create.isPending} onClick={() => create.mutate()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Create access</button>
        </div>
        {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {users.data?.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-gray-900">{user.first_name} {user.last_name}</p>
                <p className="text-sm text-gray-500">{user.email} · {user.roles.join(', ') || 'No role'}</p>
              </div>
              <button onClick={() => toggle.mutate(user)} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                {user.is_active ? <><UserX className="h-4 w-4" />Deactivate</> : <><UserCheck className="h-4 w-4" />Activate</>}
              </button>
            </div>
          ))}
        </div>
        {!users.isLoading && users.data?.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No login accounts have been created.</p>}
      </div>
    </div>
  );
}

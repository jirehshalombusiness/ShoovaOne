import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { peopleService } from '@/services/people.service';
import { usersService } from '@/services/users';

const roles = [
  'ceo',
  'executive_director',
  'director',
  'manager',
  'staff',
  'volunteer',
  'external_partner',
];

export function UsersPage() {
  const queryClient = useQueryClient();

  const [personId, setPersonId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [message, setMessage] = useState('');

  // Reset password state
  const [resetUser, setResetUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const [resetPassword, setResetPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const users = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getAll,
  });

  const people = useQuery({
    queryKey: ['people', 'user-provisioning'],
    queryFn: () => peopleService.getAll({ limit: 100 }),
  });

  const create = useMutation({
    mutationFn: () => usersService.create(personId, password, [role]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPersonId('');
      setPassword('');
      setMessage('Login access created.');
    },
    onError: () =>
      setMessage(
        'Unable to create login access. Confirm the person has an email and does not already have an account.'
      ),
  });

  const toggle = useMutation({
    mutationFn: (user: { id: string; is_active: boolean }) =>
      usersService.update(user.id, {
        is_active: !user.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const reset = useMutation({
    mutationFn: () =>
      usersService.update(resetUser!.id, {
        password: resetPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });

      setResetPassword('');
      setResetMessage(
        'Temporary password set successfully. The user must change it when they log in.'
      );
    },
    onError: (error: any) => {
      setResetMessage(
        error?.response?.data?.detail ||
          'Unable to reset the password. Please try again.'
      );
    },
  });

  const openResetPassword = (user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }) => {
    setResetUser({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
    });

    setResetPassword('');
    setResetMessage('');
  };

  const closeResetPassword = () => {
    if (reset.isPending) return;

    setResetUser(null);
    setResetPassword('');
    setResetMessage('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User access</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create and control login access for existing People records.
          Passwords are never displayed.
        </p>
      </div>

      {/* Grant Login Access */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="flex items-center gap-2 font-semibold text-gray-900">
          <KeyRound className="h-4 w-4 text-primary" />
          Grant login access
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Select a person</option>

            {people.data
              ?.filter((person) => person.email)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name} ({person.email})
                </option>
              ))}
          </select>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Temporary password"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {item.replace('_', ' ')}
              </option>
            ))}
          </select>

          <button
            disabled={!personId || !password || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create access'}
          </button>
        </div>

        {message && (
          <p className="mt-3 text-sm text-gray-600">
            {message}
          </p>
        )}
      </div>

      {/* Existing Users */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="divide-y divide-gray-100">
          {users.data?.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </p>

                <p className="text-sm text-gray-500">
                  {user.email} ·{' '}
                  {user.roles.join(', ') || 'No role'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Reset Password */}
                <button
                  onClick={() => openResetPassword(user)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <KeyRound className="h-4 w-4" />
                  Reset Password
                </button>

                {/* Activate / Deactivate */}
                <button
                  onClick={() => toggle.mutate(user)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {user.is_active ? (
                    <>
                      <UserX className="h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Activate
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!users.isLoading && users.data?.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">
            No login accounts have been created.
          </p>
        )}
      </div>

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Reset Password
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Set a temporary password for this user.
                </p>
              </div>

              <button
                onClick={closeResetPassword}
                disabled={reset.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium text-gray-900">
                  {resetUser.name}
                </p>

                <p className="text-sm text-gray-500">
                  {resetUser.email}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Temporary password
                </label>

                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter temporary password"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <p className="mt-1 text-xs text-gray-500">
                  The user will be required to change this password after
                  logging in.
                </p>
              </div>

              {resetMessage && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {resetMessage}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={closeResetPassword}
                disabled={reset.isPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={() => reset.mutate()}
                disabled={
                  !resetPassword ||
                  resetPassword.length < 8 ||
                  reset.isPending
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {reset.isPending
                  ? 'Resetting...'
                  : 'Set Temporary Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound,
  ShieldCheck,
  UserCheck,
  UserX,
  Pencil,
  X,
  LockKeyhole,
} from 'lucide-react';
import { peopleService } from '@/services/people.service';
import { usersService } from '@/services/users';

const roles = [
  { value: 'ceo', label: 'CEO' },
  { value: 'system_admin', label: 'System Administrator' },
  { value: 'executive_director', label: 'Executive Director' },
  { value: 'head_of_hr', label: 'Head of HR' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'external_partner', label: 'External Partner' },
];

export function UsersPage() {
  const queryClient = useQueryClient();

  // Create login access state
  const [personId, setPersonId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');
  const [message, setMessage] = useState('');

  // Edit roles state
  const [editUser, setEditUser] = useState<{
    id: string;
    name: string;
    email: string;
    roles: string[];
  } | null>(null);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [editRoleMessage, setEditRoleMessage] = useState('');

  // Permissions state
  const [permissionUser, setPermissionUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const [permissionMessage, setPermissionMessage] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('');

  // Reset password state
  const [resetUser, setResetUser] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const [resetPassword, setResetPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Users
  const users = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getAll,
  });

  // People
  const people = useQuery({
    queryKey: ['people', 'user-provisioning'],
    queryFn: () => peopleService.getAll({ limit: 100 }),
  });

  // Available permissions
  const availablePermissions = useQuery({
    queryKey: ['permissions', 'available'],
    queryFn: usersService.getAvailablePermissions,
    enabled: !!permissionUser,
  });

  // Selected user's permissions
  const userPermissions = useQuery({
    queryKey: ['user-permissions', permissionUser?.id],
    queryFn: () => usersService.getUserPermissions(permissionUser!.id),
    enabled: !!permissionUser,
  });

  // Create login access
  const create = useMutation({
    mutationFn: () => usersService.create(personId, password, [role]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPersonId('');
      setPassword('');
      setRole('staff');
      setMessage('Login access created.');
    },
    onError: (error: any) =>
      setMessage(
        error?.response?.data?.detail ||
          'Unable to create login access. Confirm the person has an email and does not already have an account.',
      ),
  });

  // Activate / deactivate user
  const toggle = useMutation({
    mutationFn: (user: { id: string; is_active: boolean }) =>
      usersService.update(user.id, {
        is_active: !user.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  // Edit roles
  const updateRoles = useMutation({
    mutationFn: () =>
      usersService.update(editUser!.id, {
        role_names: selectedRoles,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditRoleMessage('Roles updated successfully.');
    },
    onError: (error: any) => {
      setEditRoleMessage(
        error?.response?.data?.detail ||
          'Unable to update roles. Please try again.',
      );
    },
  });

  // Grant direct permission
  const grantPermission = useMutation({
    mutationFn: () =>
      usersService.grantPermission(
        permissionUser!.id,
        selectedPermission,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-permissions', permissionUser?.id],
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSelectedPermission('');
      setPermissionMessage('Permission granted successfully.');
    },
    onError: (error: any) => {
      setPermissionMessage(
        error?.response?.data?.detail ||
          'Unable to grant permission. Please try again.',
      );
    },
  });

  // Revoke direct permission
  const revokePermission = useMutation({
    mutationFn: (permissionId: string) =>
      usersService.revokePermission(
        permissionUser!.id,
        permissionId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['user-permissions', permissionUser?.id],
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setPermissionMessage('Permission revoked successfully.');
    },
    onError: (error: any) => {
      setPermissionMessage(
        error?.response?.data?.detail ||
          'Unable to revoke permission. Please try again.',
      );
    },
  });

  // Reset password
  const reset = useMutation({
    mutationFn: () =>
      usersService.update(resetUser!.id, {
        password: resetPassword,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });

      setResetPassword('');
      setResetMessage(
        'Temporary password set successfully. The user must change it when they log in.',
      );
    },
    onError: (error: any) => {
      setResetMessage(
        error?.response?.data?.detail ||
          'Unable to reset the password. Please try again.',
      );
    },
  });

  const openEditRoles = (user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    roles: string[];
  }) => {
    setEditUser({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      roles: user.roles || [],
    });

    setSelectedRoles(user.roles || []);
    setEditRoleMessage('');
  };

  const closeEditRoles = () => {
    if (updateRoles.isPending) return;

    setEditUser(null);
    setSelectedRoles([]);
    setEditRoleMessage('');
  };

  const toggleRole = (roleValue: string) => {
    setSelectedRoles((current) =>
      current.includes(roleValue)
        ? current.filter((value) => value !== roleValue)
        : [...current, roleValue],
    );
  };

  const openPermissions = (user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }) => {
    setPermissionUser({
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
    });

    setSelectedPermission('');
    setPermissionMessage('');
  };

  const closePermissions = () => {
    if (
      grantPermission.isPending ||
      revokePermission.isPending
    ) {
      return;
    }

    setPermissionUser(null);
    setSelectedPermission('');
    setPermissionMessage('');
  };

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

  const effectivePermissions =
    userPermissions.data?.permissions || [];

  const directPermissions =
    userPermissions.data?.direct_permissions || [];

  const directPermissionSet = new Set(directPermissions);

  const availablePermissionOptions =
    availablePermissions.data?.filter(
      (permission) => !directPermissionSet.has(permission.name),
    ) || [];

  const groupedPermissions =
    availablePermissions.data?.reduce(
      (groups, permission) => {
        if (!groups[permission.resource]) {
          groups[permission.resource] = [];
        }

        groups[permission.resource].push(permission);

        return groups;
      },
      {} as Record<
        string,
        typeof availablePermissions.data
      >,
    ) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          User access
        </h1>

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
                  {person.first_name} {person.last_name} (
                  {person.email})
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
              <option key={item.value} value={item.value}>
                {item.label}
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
              className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">
                  {user.first_name} {user.last_name}
                </p>

                <p className="text-sm text-gray-500">
                  {user.email} ·{' '}
                  {user.roles
                    .map(
                      (userRole) =>
                        roles.find(
                          (item) => item.value === userRole,
                        )?.label || userRole,
                    )
                    .join(', ') || 'No role'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Edit Roles */}
                <button
                  onClick={() => openEditRoles(user)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Roles
                </button>

                {/* Permissions */}
                <button
                  onClick={() => openPermissions(user)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LockKeyhole className="h-4 w-4" />
                  Permissions
                </button>

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
                  disabled={toggle.isPending}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
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

      {/* Edit Roles Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Edit Roles
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Assign one or more roles to this user.
                </p>
              </div>

              <button
                onClick={closeEditRoles}
                disabled={updateRoles.isPending}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium text-gray-900">
                  {editUser.name}
                </p>

                <p className="text-sm text-gray-500">
                  {editUser.email}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Roles
                </p>

                <div className="space-y-2">
                  {roles.map((item) => (
                    <label
                      key={item.value}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(item.value)}
                        onChange={() => toggleRole(item.value)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />

                      <span className="text-sm text-gray-700">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedRoles.length === 0 && (
                <p className="text-xs text-amber-600">
                  At least one role should normally be assigned to a
                  user.
                </p>
              )}

              {editRoleMessage && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {editRoleMessage}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                onClick={closeEditRoles}
                disabled={updateRoles.isPending}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={() => updateRoles.mutate()}
                disabled={
                  selectedRoles.length === 0 ||
                  updateRoles.isPending
                }
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {updateRoles.isPending ? 'Saving...' : 'Save Roles'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permissionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  Manage Permissions
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Manage permissions granted directly to this user.
                </p>
              </div>

              <button
                onClick={closePermissions}
                disabled={
                  grantPermission.isPending ||
                  revokePermission.isPending
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* User */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium text-gray-900">
                  {permissionUser.name}
                </p>

                <p className="text-sm text-gray-500">
                  {permissionUser.email}
                </p>

                {userPermissions.data?.roles &&
                  userPermissions.data.roles.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      Roles:{' '}
                      {userPermissions.data.roles
                        .map(
                          (userRole) =>
                            roles.find(
                              (item) => item.value === userRole,
                            )?.label || userRole,
                        )
                        .join(', ')}
                    </p>
                  )}
              </div>

              {/* Loading */}
              {(userPermissions.isLoading ||
                availablePermissions.isLoading) && (
                <div className="rounded-lg border border-gray-200 p-5 text-center text-sm text-gray-500">
                  Loading permissions...
                </div>
              )}

              {/* Effective Permissions */}
              {!userPermissions.isLoading && (
                <div>
                  <div className="mb-2">
                    <h3 className="font-semibold text-gray-900">
                      Effective Permissions
                    </h3>

                    <p className="text-xs text-gray-500">
                      Permissions the user currently has through roles
                      or direct grants.
                    </p>
                  </div>

                  {effectivePermissions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {effectivePermissions.map((permission) => (
                        <span
                          key={permission}
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No effective permissions.
                    </p>
                  )}
                </div>
              )}

              {/* Direct Permissions */}
              {!userPermissions.isLoading && (
                <div>
                  <div className="mb-2">
                    <h3 className="font-semibold text-gray-900">
                      Direct Permissions
                    </h3>

                    <p className="text-xs text-gray-500">
                      These permissions were explicitly granted to this
                      user.
                    </p>
                  </div>

                  {directPermissions.length > 0 ? (
                    <div className="space-y-2">
                      {directPermissions.map((permissionName) => {
                        const permission =
                          availablePermissions.data?.find(
                            (item) => item.name === permissionName,
                          );

                        return (
                          <div
                            key={permissionName}
                            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {permissionName}
                              </p>

                              {permission?.description && (
                                <p className="text-xs text-gray-500">
                                  {permission.description}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                permission &&
                                revokePermission.mutate(permission.id)
                              }
                              disabled={
                                !permission ||
                                revokePermission.isPending
                              }
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No direct permissions have been granted.
                    </p>
                  )}
                </div>
              )}

              {/* Grant Permission */}
              <div>
                <div className="mb-2">
                  <h3 className="font-semibold text-gray-900">
                    Grant Direct Permission
                  </h3>

                  <p className="text-xs text-gray-500">
                    Add a specific permission without changing the
                    user's role.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedPermission}
                    onChange={(e) =>
                      setSelectedPermission(e.target.value)
                    }
                    disabled={
                      availablePermissions.isLoading ||
                      grantPermission.isPending
                    }
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <option value="">
                      Select a permission
                    </option>

                    {Object.entries(groupedPermissions).map(
                      ([resource, resourcePermissions]) => (
                        <optgroup
                          key={resource}
                          label={
                            resource.charAt(0).toUpperCase() +
                            resource.slice(1)
                          }
                        >
                          {resourcePermissions?.map((permission) => (
                            <option
                              key={permission.id}
                              value={permission.name}
                              disabled={
                                !availablePermissionOptions.some(
                                  (item) =>
                                    item.id === permission.id,
                                )
                              }
                            >
                              {permission.action.replace(
                                /_/g,
                                ' ',
                              )}
                              {!availablePermissionOptions.some(
                                (item) =>
                                  item.id === permission.id,
                              )
                                ? ' — already granted'
                                : ''}
                            </option>
                          ))}
                        </optgroup>
                      ),
                    )}
                  </select>

                  <button
                    onClick={() => grantPermission.mutate()}
                    disabled={
                      !selectedPermission ||
                      grantPermission.isPending
                    }
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {grantPermission.isPending
                      ? 'Granting...'
                      : 'Grant Permission'}
                  </button>
                </div>
              </div>

              {permissionMessage && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {permissionMessage}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-gray-100 px-5 py-4">
              <button
                onClick={closePermissions}
                disabled={
                  grantPermission.isPending ||
                  revokePermission.isPending
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl">
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
            <div className="space-y-4 overflow-y-auto px-5 py-5">
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
                  The user will be required to change this password
                  after logging in.
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
import { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { rolesService } from '../roles.service';

import type {
  Permission,
  Role,
  RoleDetail,
} from '../roles.types';

/* ============================================================
   LABELS
   ============================================================ */

const RESOURCE_LABELS: Record<string, string> = {
  people: 'People',
  users: 'Users',
  roles: 'Roles & Permissions',
  hr: 'Human Resources',
  attendance: 'Attendance',
  timesheets: 'Timesheets',
  projects: 'Projects',
  tasks: 'Tasks',
  documents: 'Documents',
  finance: 'Finance',
  organisation: 'Organisation',
  programmes: 'Programmes',
  crm: 'CRM',
  audit: 'Audit',
  events: 'Events',
};

const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  review: 'Review',
  disburse: 'Disburse',
  reconcile: 'Reconcile',
  reports: 'Reports',
  manage: 'Manage',
  upload: 'Upload',
  checkin: 'Check In',
  submit: 'Submit',
  edit_any: 'Edit Any',
  edit_sensitive: 'Edit Sensitive',
  view_sensitive: 'View Sensitive',
  edit_employment: 'Edit Employment',
  view_employment: 'View Employment',
  edit_compensation: 'Edit Compensation',
  view_compensation: 'View Compensation',
  edit_leave: 'Edit Leave',
  view_leave: 'View Leave',
  edit_performance: 'Edit Performance',
  view_performance: 'View Performance',
  view_basic: 'View Basic',
};

/* ============================================================
   HELPERS
   ============================================================ */

function formatRoleName(name: string) {
  return name
    .split('_')
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(' ');
}

function formatResource(resource: string) {
  return (
    RESOURCE_LABELS[resource] ||
    resource
      .split('_')
      .map(
        (part) =>
          part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(' ')
  );
}

function formatAction(action: string) {
  return (
    ACTION_LABELS[action] ||
    action
      .split('_')
      .map(
        (part) =>
          part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(' ')
  );
}

function getErrorMessage(error: any, fallback: string) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (detail?.message) {
    return detail.message;
  }

  return fallback;
}

/* ============================================================
   PERMISSION GROUP
   ============================================================ */

function PermissionGroup({
  resource,
  permissions,
  selectedIds,
  onToggle,
}: {
  resource: string;
  permissions: Permission[];
  selectedIds: Set<string>;
  onToggle: (permissionId: string) => void;
}) {
  const [open, setOpen] = useState(true);

  const selectedCount = permissions.filter((permission) =>
    selectedIds.has(permission.id),
  ).length;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}

          <div>
            <p className="text-sm font-semibold text-gray-900">
              {formatResource(resource)}
            </p>

            <p className="mt-0.5 text-xs text-gray-500">
              {permissions.length}{' '}
              {permissions.length === 1
                ? 'permission'
                : 'permissions'}
            </p>
          </div>
        </div>

        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {selectedCount} selected
        </span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {permissions.map((permission) => {
            const selected = selectedIds.has(permission.id);

            return (
              <label
                key={permission.id}
                className="flex cursor-pointer items-start gap-3 px-4 py-3 transition hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(permission.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />

                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {formatAction(permission.action)}
                  </p>

                  <p className="mt-0.5 text-xs text-gray-400">
                    {permission.resource}.{permission.action}
                  </p>

                  {permission.description && (
                    <p className="mt-1 text-xs text-gray-500">
                      {permission.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ROLE DETAIL PANEL
   ============================================================ */

function RoleDetailPanel({
  role,
  groupedPermissions,
  selectedPermissionIds,
  onTogglePermission,
  onClose,
  editingDescription,
  setEditingDescription,
  roleDescription,
  setRoleDescription,
  onSaveDescription,
  isSavingDescription,
  onDelete,
  isDeleting,
}: {
  role: RoleDetail;
  groupedPermissions: Record<string, Permission[]>;
  selectedPermissionIds: Set<string>;
  onTogglePermission: (permissionId: string) => void;
  onClose: () => void;
  editingDescription: boolean;
  setEditingDescription: (value: boolean) => void;
  roleDescription: string;
  setRoleDescription: (value: string) => void;
  onSaveDescription: () => void;
  isSavingDescription: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const permissionGroups = Object.entries(
    groupedPermissions,
  );

  return (
    <div className="space-y-5">
      {/* Role header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  {formatRoleName(role.name)}
                </h2>

                {role.is_system && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    System Role
                  </span>
                )}
              </div>

              {!editingDescription ? (
                <div className="mt-2 flex items-start gap-2">
                  <p className="text-sm text-gray-500">
                    {role.description ||
                      'No description provided.'}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setRoleDescription(
                        role.description || '',
                      );
                      setEditingDescription(true);
                    }}
                    className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Edit description"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 max-w-xl">
                  <textarea
                    value={roleDescription}
                    onChange={(event) =>
                      setRoleDescription(event.target.value)
                    }
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={onSaveDescription}
                      disabled={isSavingDescription}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSavingDescription
                        ? 'Saving...'
                        : 'Save'}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingDescription(false)
                      }
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>
                  <strong className="text-gray-700">
                    {role.user_count}
                  </strong>{' '}
                  {role.user_count === 1 ? 'user' : 'users'}
                </span>

                <span>
                  <strong className="text-gray-700">
                    {role.permissions.length}
                  </strong>{' '}
                  {role.permissions.length === 1
                    ? 'permission'
                    : 'permissions'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!role.is_system && (
              <button
                type="button"
                onClick={onDelete}
                disabled={
                  isDeleting || role.user_count > 0
                }
                className="flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  role.user_count > 0
                    ? 'Remove this role from users before deleting it.'
                    : 'Delete role'
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div>
        <div className="mb-3">
          <h3 className="text-base font-semibold text-gray-900">
            Permissions
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            Control what users assigned to this role can do.
            Changes are saved immediately.
          </p>
        </div>

        <div className="space-y-3">
          {permissionGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <Shield className="mx-auto h-8 w-8 text-gray-300" />

              <p className="mt-3 text-sm font-medium text-gray-700">
                No permissions configured
              </p>

              <p className="mt-1 text-xs text-gray-500">
                There are currently no permissions available
                in the system.
              </p>
            </div>
          ) : (
            permissionGroups.map(
              ([resource, resourcePermissions]) => (
                <PermissionGroup
                  key={resource}
                  resource={resource}
                  permissions={resourcePermissions}
                  selectedIds={selectedPermissionIds}
                  onToggle={onTogglePermission}
                />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export function RolesPermissionsPage() {
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState<
    string | null
  >(null);

  const [showCreate, setShowCreate] = useState(false);

  const [editingDescription, setEditingDescription] =
    useState(false);

  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] =
    useState('');

  const [message, setMessage] = useState('');

  /* ----------------------------------------------------------
     ROLES
     ---------------------------------------------------------- */

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: rolesService.getRoles,
  });

  /* ----------------------------------------------------------
     AVAILABLE PERMISSIONS
     ---------------------------------------------------------- */

  const permissions = useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: rolesService.getPermissions,
  });

  /* ----------------------------------------------------------
     SELECTED ROLE
     ---------------------------------------------------------- */

  const selectedRole = useQuery({
    queryKey: ['role', selectedRoleId],
    queryFn: () =>
      rolesService.getRole(selectedRoleId!),
    enabled: Boolean(selectedRoleId),
  });

  /* ----------------------------------------------------------
     CREATE ROLE
     ---------------------------------------------------------- */

  const createRole = useMutation({
    mutationFn: rolesService.createRole,

    onSuccess: async (role) => {
      await queryClient.invalidateQueries({
        queryKey: ['roles'],
      });

      setSelectedRoleId(role.id);

      setShowCreate(false);
      setRoleName('');
      setRoleDescription('');

      setMessage('Role created successfully.');
    },

    onError: (error: any) => {
      setMessage(
        getErrorMessage(
          error,
          'Unable to create role.',
        ),
      );
    },
  });

  /* ----------------------------------------------------------
     UPDATE ROLE
     ---------------------------------------------------------- */

  const updateRole = useMutation({
    mutationFn: ({
      roleId,
      description,
    }: {
      roleId: string;
      description: string;
    }) =>
      rolesService.updateRole(roleId, {
        description,
      }),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['roles'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['role', selectedRoleId],
      });

      setEditingDescription(false);

      setMessage('Role updated successfully.');
    },

    onError: (error: any) => {
      setMessage(
        getErrorMessage(
          error,
          'Unable to update role.',
        ),
      );
    },
  });

  /* ----------------------------------------------------------
     UPDATE PERMISSIONS
     ---------------------------------------------------------- */

  const updatePermissions = useMutation({
    mutationFn: ({
      roleId,
      permissionIds,
    }: {
      roleId: string;
      permissionIds: string[];
    }) =>
      rolesService.updateRolePermissions(
        roleId,
        {
          permission_ids: permissionIds,
        },
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['roles'],
      });

      await queryClient.invalidateQueries({
        queryKey: ['role', selectedRoleId],
      });

      setMessage(
        'Permissions updated successfully.',
      );
    },

    onError: (error: any) => {
      setMessage(
        getErrorMessage(
          error,
          'Unable to update permissions.',
        ),
      );
    },
  });

  /* ----------------------------------------------------------
     DELETE ROLE
     ---------------------------------------------------------- */

  const deleteRole = useMutation({
    mutationFn: rolesService.deleteRole,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['roles'],
      });

      setSelectedRoleId(null);
      setEditingDescription(false);

      setMessage('Role deleted successfully.');
    },

    onError: (error: any) => {
      setMessage(
        getErrorMessage(
          error,
          'Unable to delete role.',
        ),
      );
    },
  });

  /* ----------------------------------------------------------
     GROUP PERMISSIONS
     ---------------------------------------------------------- */

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};

    for (const permission of permissions.data || []) {
      if (!groups[permission.resource]) {
        groups[permission.resource] = [];
      }

      groups[permission.resource].push(permission);
    }

    return groups;
  }, [permissions.data]);

  /* ----------------------------------------------------------
     SELECTED PERMISSION IDS
     ---------------------------------------------------------- */

  const selectedPermissionIds = useMemo(() => {
    return new Set(
      (selectedRole.data?.permissions || []).map(
        (permission) => permission.id,
      ),
    );
  }, [selectedRole.data]);

  /* ----------------------------------------------------------
     TOGGLE PERMISSION
     ---------------------------------------------------------- */

  const togglePermission = (
    permissionId: string,
  ) => {
    if (!selectedRole.data) {
      return;
    }

    const next = new Set(
      selectedPermissionIds,
    );

    if (next.has(permissionId)) {
      next.delete(permissionId);
    } else {
      next.add(permissionId);
    }

    updatePermissions.mutate({
      roleId: selectedRole.data.id,
      permissionIds: Array.from(next),
    });
  };

  /* ----------------------------------------------------------
     CREATE ROLE
     ---------------------------------------------------------- */

  const handleCreateRole = () => {
    const trimmedName = roleName.trim();

    if (!trimmedName) {
      setMessage('Enter a role name.');
      return;
    }

    createRole.mutate({
      name: trimmedName,
      description:
        roleDescription.trim() || undefined,
    });
  };

  /* ----------------------------------------------------------
     SAVE DESCRIPTION
     ---------------------------------------------------------- */

  const handleDescriptionSave = () => {
    if (!selectedRole.data) {
      return;
    }

    updateRole.mutate({
      roleId: selectedRole.data.id,
      description: roleDescription,
    });
  };

  /* ----------------------------------------------------------
     OPEN ROLE
     ---------------------------------------------------------- */

  const openRole = (role: Role) => {
    setSelectedRoleId(role.id);

    setEditingDescription(false);

    setRoleDescription(
      role.description || '',
    );

    setMessage('');
  };

  /* ----------------------------------------------------------
     CLOSE ROLE
     ---------------------------------------------------------- */

  const closeRole = () => {
    setSelectedRoleId(null);

    setEditingDescription(false);

    setRoleDescription('');

    setMessage('');
  };

  /* ----------------------------------------------------------
     LOADING
     ---------------------------------------------------------- */

  if (
    roles.isLoading ||
    permissions.isLoading
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ----------------------------------------------------------
     ERROR
     ---------------------------------------------------------- */

  if (
    roles.isError ||
    permissions.isError
  ) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            Unable to load Roles & Permissions
          </h2>

          <p className="mt-1 text-sm text-red-700">
            Please refresh the page and try again.
          </p>
        </div>
      </div>
    );
  }

  /* ----------------------------------------------------------
     PAGE
     ---------------------------------------------------------- */

  return (
    <div className="p-6">
      {/* ======================================================
          HEADER
          ====================================================== */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Roles & Permissions
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Manage roles, permissions, and access
                across ShoovaOne.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setMessage('');
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create Role
        </button>
      </div>

      {/* ======================================================
          MESSAGE
          ====================================================== */}

      {message && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
          <span>{message}</span>

          <button
            type="button"
            onClick={() => setMessage('')}
            className="text-gray-400 transition hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ======================================================
          SUMMARY CARDS
          ====================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Roles */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />

            <div>
              <p className="text-sm text-gray-500">
                Total Roles
              </p>

              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {roles.data?.length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />

            <div>
              <p className="text-sm text-gray-500">
                Available Permissions
              </p>

              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {permissions.data?.length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />

            <div>
              <p className="text-sm text-gray-500">
                Assigned Users
              </p>

              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {roles.data?.reduce(
                  (total, role) =>
                    total + role.user_count,
                  0,
                ) || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* ====================================================
            ROLE LIST
            ==================================================== */}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Roles
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Select a role to manage its permissions.
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {roles.data?.length === 0 ? (
              <div className="p-6 text-center">
                <Shield className="mx-auto h-8 w-8 text-gray-300" />

                <p className="mt-3 text-sm font-medium text-gray-700">
                  No roles found
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Create your first custom role.
                </p>
              </div>
            ) : (
              roles.data?.map((role) => {
                const selected =
                  selectedRoleId === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() =>
                      openRole(role)
                    }
                    className={`w-full px-5 py-4 text-left transition ${
                      selected
                        ? 'bg-primary/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {formatRoleName(
                              role.name,
                            )}
                          </p>

                          {role.is_system && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              System
                            </span>
                          )}
                        </div>

                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {role.description ||
                            'No description provided.'}
                        </p>

                        <div className="mt-2 flex gap-3 text-xs text-gray-400">
                          <span>
                            {role.permission_count}{' '}
                            permissions
                          </span>

                          <span>
                            {role.user_count}{' '}
                            users
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ====================================================
            ROLE DETAILS
            ==================================================== */}

        <div className="min-w-0">
          {!selectedRoleId ? (
            <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <div className="max-w-md">
                <Shield className="mx-auto h-10 w-10 text-gray-300" />

                <h2 className="mt-4 text-lg font-semibold text-gray-800">
                  Select a role
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Choose a role from the list to
                  view and manage its permissions.
                </p>
              </div>
            </div>
          ) : selectedRole.isLoading ? (
            <div className="flex min-h-[500px] items-center justify-center rounded-xl border border-gray-200 bg-white">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : selectedRole.isError ||
            !selectedRole.data ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm text-red-700">
                Unable to load this role.
              </p>
            </div>
          ) : (
            <RoleDetailPanel
              role={selectedRole.data}
              groupedPermissions={
                groupedPermissions
              }
              selectedPermissionIds={
                selectedPermissionIds
              }
              onTogglePermission={
                togglePermission
              }
              onClose={closeRole}
              editingDescription={
                editingDescription
              }
              setEditingDescription={
                setEditingDescription
              }
              roleDescription={
                roleDescription
              }
              setRoleDescription={
                setRoleDescription
              }
              onSaveDescription={
                handleDescriptionSave
              }
              isSavingDescription={
                updateRole.isPending
              }
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete the role "${formatRoleName(
                      selectedRole.data!.name,
                    )}"?`,
                  )
                ) {
                  deleteRole.mutate(
                    selectedRole.data!.id,
                  );
                }
              }}
              isDeleting={
                deleteRole.isPending
              }
            />
          )}
        </div>
      </div>

      {/* ======================================================
          CREATE ROLE MODAL
          ====================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Create Custom Role
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Create a role and assign its
                  permissions afterward.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Role name
                </label>

                <input
                  value={roleName}
                  onChange={(event) =>
                    setRoleName(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Programme Coordinator"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  value={roleDescription}
                  onChange={(event) =>
                    setRoleDescription(
                      event.target.value,
                    )
                  }
                  rows={4}
                  placeholder="Describe what this role is responsible for."
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  createRole.isPending ||
                  !roleName.trim()
                }
                onClick={handleCreateRole}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createRole.isPending
                  ? 'Creating...'
                  : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
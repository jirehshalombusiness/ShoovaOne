export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  user_count: number;
  permission_count: number;
}

export interface RoleDetail extends Role {
  permissions: Permission[];
}

export interface RoleCreatePayload {
  name: string;
  description?: string;
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
}

export interface RolePermissionsUpdatePayload {
  permission_ids: string[];
}
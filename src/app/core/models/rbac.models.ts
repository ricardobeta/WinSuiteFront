export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

export interface RolePermission {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: Record<string, RolePermission>;
  system?: boolean;
  updatedAt?: number;
}

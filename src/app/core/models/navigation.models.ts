import { PermissionAction } from './rbac.models';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: NavItem[];
  requiredModule?: string;
  requiredAction?: PermissionAction;
}

export interface BreadcrumbState {
  module: string;
  page: string;
}

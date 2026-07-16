import { Injectable, computed, inject } from '@angular/core';

import { NavItem } from '../models/navigation.models';
import { PermissionAction, RolePermission } from '../models/rbac.models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthorizationService {
  private readonly auth = inject(AuthService);

  readonly permissionsMap = computed(() => {
    const profile = this.auth.currentProfile();
    const roles = this.auth.roles();
    if (!profile) {
      return {} as Record<string, RolePermission>;
    }

    if (profile.role.toUpperCase() === 'ADMIN') {
      return {
        '*': { canCreate: true, canRead: true, canUpdate: true, canDelete: true }
      };
    }

    const role = roles.find((item) => item.id === profile.role || item.name?.toUpperCase() === profile.role.toUpperCase());
    return role?.permissions ?? {};
  });

  canAccess(moduleKey: string, action: PermissionAction = 'read'): boolean {
    const profile = this.auth.currentProfile();
    if (!profile) {
      return false;
    }

    if (profile.role.toUpperCase() === 'ADMIN') {
      return true;
    }

    if (action === 'read' && ['empresa_general', 'empresa_calendario', 'empresa_notificaciones'].includes(moduleKey)) {
      return true;
    }

    if (['empresa_modulos', 'empresa_auditoria'].includes(moduleKey)) {
      return false;
    }

    const permission = this.permissionsMap()[moduleKey]
      ?? (['empresa_colaboradores', 'empresa_roles'].includes(moduleKey)
        ? this.permissionsMap()['colaboradores']
        : undefined);
    if (!permission) {
      return false;
    }

    switch (action) {
      case 'create':
        return permission.canCreate;
      case 'read':
        return permission.canRead;
      case 'update':
        return permission.canUpdate;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  }

  isModuleEnabled(moduleKey: string): boolean {
    if (['dashboard', 'clientes', 'empresa_general', 'empresa_calendario', 'empresa_notificaciones', 'empresa_modulos', 'empresa_auditoria', 'empresa_colaboradores', 'empresa_roles'].includes(moduleKey)) {
      return true;
    }
    const activeModules = this.auth.activeModules();
    return activeModules.length === 0 || activeModules.includes(moduleKey);
  }

  filterNavItems(items: NavItem[]): NavItem[] {
    return items
      .map((item) => {
        const children = item.children ? this.filterNavItems(item.children) : undefined;
        return { ...item, children };
      })
      .filter((item) => {
        const moduleKey = item.requiredModule;
        const action = item.requiredAction ?? 'read';
        const byPermission = moduleKey ? this.canAccess(moduleKey, action) : true;
        const byCompanyModule = moduleKey ? this.isModuleEnabled(moduleKey) : true;
        const hasVisibleChildren = !!item.children?.length;
        return byPermission && byCompanyModule && (item.route ? true : hasVisibleChildren || !item.children);
      });
  }
}

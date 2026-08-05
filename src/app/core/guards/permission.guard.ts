import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { PermissionAction } from '../models/rbac.models';
import { AuthService } from '../services/auth.service';
import { AuthorizationService } from '../services/authorization.service';

export const workspaceAuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInitialBootstrap();

  if (!authService.isAuthenticated()) {
    return router.parseUrl('/auth/login');
  }

  if (authService.isPlatformAdmin()) {
    return router.parseUrl('/super-admin');
  }

  return true;
};

export const redirectAuthenticatedGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInitialBootstrap();

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.parseUrl(
    authService.isPlatformAdmin() ? '/super-admin' : '/workspace/dashboard'
  );
};

export function moduleAccessGuard(moduleKey: string, action: PermissionAction = 'read'): CanMatchFn {
  return async (): Promise<boolean | import('@angular/router').UrlTree> => {
    const authService = inject(AuthService);
    const authorizationService = inject(AuthorizationService);
    const router = inject(Router);

    await authService.waitForInitialBootstrap();

    if (!authService.isAuthenticated()) {
      return router.parseUrl('/auth/login');
    }

    if (!authorizationService.canAccess(moduleKey, action)) {
      return router.parseUrl('/workspace/dashboard');
    }

    return true;
  };
}

/**
 * Protege el panel de super administracion. El guard solo evita mostrar la interfaz: la
 * autorizacion real la impone el backend, que rechaza /api/platform/** para cualquier correo
 * que no este en su lista.
 */
export const platformAdminGuard: CanMatchFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInitialBootstrap();

  if (!authService.isAuthenticated()) {
    return router.parseUrl('/auth/login');
  }

  if (!authService.isPlatformAdmin()) {
    return router.parseUrl('/workspace/dashboard');
  }

  return true;
};

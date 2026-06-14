import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { PermissionAction } from '../models/rbac.models';
import { AuthService } from '../services/auth.service';
import { AuthorizationService } from '../services/authorization.service';

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

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { redirectAuthenticatedGuard, workspaceAuthGuard } from './permission.guard';

describe('session route guards', () => {
  const auth = {
    isAuthenticated: signal(false),
    isPlatformAdmin: signal(false),
    waitForInitialBootstrap: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    auth.isAuthenticated.set(false);
    auth.isPlatformAdmin.set(false);
    auth.waitForInitialBootstrap.mockClear();

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  it('redirects an authenticated company user away from login', async () => {
    auth.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      redirectAuthenticatedGuard({} as never, {} as never),
    );

    expect(auth.waitForInitialBootstrap).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/workspace/dashboard');
  });

  it('allows an anonymous user to see login', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      redirectAuthenticatedGuard({} as never, {} as never),
    );

    expect(result).toBe(true);
  });

  it('waits for restoration before allowing the workspace', async () => {
    auth.isAuthenticated.set(true);

    const result = await TestBed.runInInjectionContext(() =>
      workspaceAuthGuard({} as never, {} as never),
    );

    expect(auth.waitForInitialBootstrap).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('redirects an anonymous user from workspace to login', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      workspaceAuthGuard({} as never, {} as never),
    );

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/auth/login');
  });

  it('redirects a platform administrator to its own panel', async () => {
    auth.isAuthenticated.set(true);
    auth.isPlatformAdmin.set(true);

    const loginResult = await TestBed.runInInjectionContext(() =>
      redirectAuthenticatedGuard({} as never, {} as never),
    );
    const workspaceResult = await TestBed.runInInjectionContext(() =>
      workspaceAuthGuard({} as never, {} as never),
    );
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(loginResult as UrlTree)).toBe('/super-admin');
    expect(router.serializeUrl(workspaceResult as UrlTree)).toBe('/super-admin');
  });
});

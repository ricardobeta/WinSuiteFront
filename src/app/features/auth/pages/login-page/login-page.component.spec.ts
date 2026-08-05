import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../../core/services/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent company loading transition', () => {
  const auth = {
    loading: signal(false),
    error: signal<string | null>(null),
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    isPlatformAdmin: signal(false),
  };

  beforeEach(async () => {
    auth.loading.set(false);
    auth.error.set(null);
    auth.isPlatformAdmin.set(false);
    auth.login.mockReset();
    auth.loginWithGoogle.mockReset();

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
  });

  it('shows the overlay immediately and keeps it through a successful email navigation', async () => {
    let resolveLogin!: () => void;
    auth.login.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.componentInstance['form'].setValue({
      email: 'usuario@winsuit.test',
      password: 'segura',
      remember: true,
    });

    const pendingLogin = fixture.componentInstance['submit']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeTruthy();

    resolveLogin();
    await pendingLogin;
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/workspace');
    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeTruthy();
  });

  it('removes the overlay when the email login fails', async () => {
    auth.login.mockRejectedValue(new Error('Credenciales invalidas'));
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.componentInstance['form'].setValue({
      email: 'usuario@winsuit.test',
      password: 'incorrecta',
      remember: true,
    });

    await fixture.componentInstance['submit']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeFalsy();
  });

  it('shows the same transition immediately for Google login', async () => {
    let rejectGoogle!: (reason: unknown) => void;
    auth.loginWithGoogle.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectGoogle = reject;
        }),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    const pendingLogin = fixture.componentInstance['continueWithGoogle']();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeTruthy();

    rejectGoogle(new Error('Ventana cancelada'));
    await pendingLogin;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeFalsy();
  });
});

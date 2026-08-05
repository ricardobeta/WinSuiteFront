import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from './core/services/auth.service';
import { App } from './app';

describe('App', () => {
  const auth = {
    initialBootstrapPending: signal(false),
    currentTenant: signal<{ name: string } | null>(null),
  };

  beforeEach(async () => {
    auth.initialBootstrapPending.set(false);
    auth.currentTenant.set(null);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      }),
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('shows the company transition while restoring a session route', () => {
    window.history.replaceState({}, '', '/workspace/dashboard');
    auth.initialBootstrapPending.set(true);
    auth.currentTenant.set({ name: 'Empresa Alfa' });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Empresa Alfa');

    auth.initialBootstrapPending.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeFalsy();
  });
});

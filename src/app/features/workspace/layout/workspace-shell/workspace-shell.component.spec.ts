import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { CompanyInvitationService } from '../../../../core/services/company-invitation.service';
import { CompanyNotificationService } from '../../../../core/services/company-notification.service';
import { PlanService } from '../../../../core/services/plan.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { PosImmersiveService } from '../../../ventas/services/pos-immersive.service';
import { WorkspaceShellComponent } from './workspace-shell.component';

describe('WorkspaceShellComponent company transition', () => {
  const auth = {
    tenantId: signal<string | null>('tenant-1'),
    companies: signal([
      { tenantId: 'tenant-1', name: 'Empresa Alfa', role: 'OWNER' },
      { tenantId: 'tenant-2', name: 'Empresa Beta', role: 'ADMIN' },
    ]),
    switchCompany: vi.fn(),
  };
  const snackBar = { open: vi.fn() };

  beforeEach(async () => {
    auth.tenantId.set('tenant-1');
    auth.switchCompany.mockReset();
    snackBar.open.mockReset();

    await TestBed.configureTestingModule({
      imports: [WorkspaceShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: AuthorizationService, useValue: { filterNavItems: () => [] } },
        { provide: PlanService, useValue: {} },
        { provide: ThemeService, useValue: { theme: signal('light'), toggleTheme: vi.fn() } },
        {
          provide: CompanyNotificationService,
          useValue: {
            unreadCount: signal(0),
            items: signal([]),
            foregroundPush: EMPTY,
            load: () => of([]),
            syncPush: vi.fn(),
          },
        },
        {
          provide: CompanyInvitationService,
          useValue: { pending: signal([]), load: () => of([]) },
        },
        { provide: PosImmersiveService, useValue: { immersive: signal(false) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    })
      .overrideComponent(WorkspaceShellComponent, {
        set: {
          template: `
            <button class="switch-company" type="button" (click)="switchCompany('tenant-2', 'Empresa Beta')">
              Cambiar empresa
            </button>
            @if (companyTransition(); as transition) {
              <app-company-loading-overlay [companyName]="transition.name" />
            }
          `,
        },
      })
      .compileComponents();
  });

  it('shows the target immediately, blocks repeated requests and recovers after an error', async () => {
    let rejectSwitch!: (reason: unknown) => void;
    auth.switchCompany.mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectSwitch = reject;
        }),
    );

    const fixture = TestBed.createComponent(WorkspaceShellComponent);
    const componentSnackBar = (
      fixture.componentInstance as unknown as {
        snackBar: MatSnackBar;
      }
    ).snackBar;
    const openSnackBar = vi.spyOn(componentSnackBar, 'open');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.switch-company') as HTMLButtonElement;

    button.click();
    button.click();
    fixture.detectChanges();

    expect(auth.switchCompany).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Empresa Beta');
    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeTruthy();

    rejectSwitch(new Error('No disponible'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-company-loading-overlay')).toBeFalsy();
    expect(openSnackBar).toHaveBeenCalledWith('No se pudo cambiar de empresa.', 'Cerrar', {
      duration: 3200,
    });
  });
});

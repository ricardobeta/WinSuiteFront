import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom, map, startWith } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BreadcrumbState, NavItem } from '../../../../core/models/navigation.models';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { WORKSPACE_NAV_ITEMS } from '../../config/workspace-nav.config';
import { GlobalCopilotComponent } from '../global-copilot/global-copilot.component';
import { CreateCompanyDialogComponent } from '../../components/create-company-dialog/create-company-dialog.component';
import { CompanyNotification } from '../../../../core/models/notification.models';
import { CompanyNotificationService } from '../../../../core/services/company-notification.service';
import { CompanyInvitation } from '../../../../core/models/company-invitation.models';
import { CompanyInvitationService } from '../../../../core/services/company-invitation.service';

@Component({
  selector: 'app-workspace-shell',
  imports: [DatePipe, RouterLink, RouterOutlet, GlobalCopilotComponent, MatDialogModule, MatMenuModule, MatSnackBarModule],
  templateUrl: './workspace-shell.component.html',
  styleUrl: './workspace-shell.component.scss'
})
export class WorkspaceShellComponent {
  protected readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly auth = inject(AuthService);
  protected readonly authorization = inject(AuthorizationService);
  protected readonly theme = inject(ThemeService);
  protected readonly notifications = inject(CompanyNotificationService);
  protected readonly invitations = inject(CompanyInvitationService);
  protected readonly invitationActionId = signal<string | null>(null);
  protected readonly totalNotificationCount = computed(() =>
    this.notifications.unreadCount() + this.invitations.pending().length
  );
  protected readonly menuItems = computed(() => this.authorization.filterNavItems(WORKSPACE_NAV_ITEMS));
  protected readonly isSidebarCollapsed = signal(true);
  protected readonly expandedMenuIds = signal<Set<string>>(new Set(['sales']));

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  protected readonly breadcrumb = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.resolveBreadcrumb())
    ),
    {
      initialValue: {
        module: 'Workspace',
        page: 'Dashboard'
      }
    }
  );

  protected readonly copilotContext = computed(() => ({
    route: this.currentUrl(),
    module: this.breadcrumb().module,
    page: this.breadcrumb().page
  }));

  constructor() {
    this.notifications.load().subscribe({ error: () => undefined });
    this.invitations.load().subscribe({ error: () => undefined });
  }

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update((value) => !value);
  }

  protected closeSidebarOnMobile(): void {
    if (this.isMobileViewport()) {
      this.isSidebarCollapsed.set(true);
    }
  }

  protected toggleMenu(itemId: string): void {
    const current = new Set(this.expandedMenuIds());

    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }

    this.expandedMenuIds.set(current);
  }

  protected isExpanded(itemId: string): boolean {
    return this.expandedMenuIds().has(itemId);
  }

  protected isActive(item: NavItem): boolean {
    if (item.route) {
      return this.currentUrl().startsWith(item.route);
    }

    return item.children?.some((child) => this.isActive(child)) ?? false;
  }

  protected onMenuItemClick(item: NavItem): void {
    if (item.children?.length) {
      if (this.isSidebarCollapsed()) {
        this.isSidebarCollapsed.set(false);
      }
      this.toggleMenu(item.id);
      return;
    }

    if (item.route) {
      void this.router.navigateByUrl(item.route).then(() => {
        this.closeSidebarOnMobile();
      });
    }
  }

  protected async onLogout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  protected openNotifications(): void {
    this.notifications.load().subscribe({ error: () => this.snackBar.open('No se pudieron cargar las notificaciones.', 'Cerrar', { duration: 3000 }) });
    this.invitations.load().subscribe({ error: () => this.snackBar.open('No se pudieron cargar las invitaciones.', 'Cerrar', { duration: 3000 }) });
  }

  protected async acceptInvitation(invitation: CompanyInvitation): Promise<void> {
    if (this.invitationActionId()) return;
    this.invitationActionId.set(invitation.id);
    try {
      await firstValueFrom(this.invitations.accept(invitation.id));
      await this.auth.refreshCompanies();
      const message = this.snackBar.open(`Ahora formas parte de ${invitation.tenantName}.`, 'Cambiar empresa', { duration: 7000 });
      message.onAction().subscribe(() => void this.switchCompany(invitation.tenantId));
    } catch {
      this.snackBar.open('No se pudo aceptar la invitación.', 'Cerrar', { duration: 3600 });
      this.invitations.load().subscribe({ error: () => undefined });
    } finally {
      this.invitationActionId.set(null);
    }
  }

  protected async rejectInvitation(invitation: CompanyInvitation): Promise<void> {
    if (this.invitationActionId()) return;
    this.invitationActionId.set(invitation.id);
    try {
      await firstValueFrom(this.invitations.reject(invitation.id));
      this.snackBar.open(`Invitación de ${invitation.tenantName} rechazada.`, 'Cerrar', { duration: 3000 });
    } catch {
      this.snackBar.open('No se pudo responder la invitación.', 'Cerrar', { duration: 3600 });
    } finally {
      this.invitationActionId.set(null);
    }
  }

  protected openNotification(item: CompanyNotification): void {
    this.notifications.markRead(item);
    if (item.link?.startsWith('/workspace/')) void this.router.navigateByUrl(item.link);
  }

  protected async switchCompany(tenantId: string): Promise<void> {
    if (tenantId === this.auth.tenantId()) return;
    try {
      await this.auth.switchCompany(tenantId);
      window.location.assign('/workspace/dashboard');
    } catch {
      this.snackBar.open('No se pudo cambiar de empresa.', 'Cerrar', { duration: 3200 });
    }
  }

  protected openCreateCompany(): void {
    const dialogRef = this.dialog.open(CreateCompanyDialogComponent, {
      width: '500px', maxWidth: '94vw', autoFocus: 'first-tabbable'
    });
    dialogRef.afterClosed().subscribe(async (name) => {
      if (!name) return;
      try {
        await this.auth.createCompany(name);
        window.location.assign('/workspace/empresa/general');
      } catch {
        this.snackBar.open('No se pudo crear la empresa. Revisa el limite de tu plan.', 'Cerrar', { duration: 4200 });
      }
    });
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px)').matches;
  }

  private resolveBreadcrumb(): BreadcrumbState {
    let route: ActivatedRoute | null = this.activatedRoute;
    while (route?.firstChild) {
      route = route.firstChild;
    }

    const moduleName = route?.snapshot?.data?.['module'] as string | undefined;
    const pageName = route?.snapshot?.data?.['page'] as string | undefined;

    return {
      module: moduleName ?? 'Workspace',
      page: pageName ?? 'Dashboard'
    };
  }
}

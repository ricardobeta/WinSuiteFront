import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';

import { BreadcrumbState, NavItem } from '../../../../core/models/navigation.models';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { WORKSPACE_NAV_ITEMS } from '../../config/workspace-nav.config';

@Component({
  selector: 'app-workspace-shell',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './workspace-shell.component.html',
  styleUrl: './workspace-shell.component.scss'
})
export class WorkspaceShellComponent {
  protected readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  protected readonly auth = inject(AuthService);
  protected readonly authorization = inject(AuthorizationService);
  protected readonly theme = inject(ThemeService);
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

  protected readonly moduleSearchPlaceholder = computed(() => {
    const moduleName = this.breadcrumb().module.toLowerCase();
    return `Buscar en ${moduleName}...`;
  });

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

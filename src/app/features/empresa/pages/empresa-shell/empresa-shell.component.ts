import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthorizationService } from '../../../../core/services/authorization.service';
import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

interface CompanyNavItem extends ModuleNavItem { resource: string; }

@Component({
  selector: 'app-empresa-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="empresa"
      eyebrow="Administración central"
      title="Configuración de la empresa"
      description="Información, equipo, seguridad y herramientas compartidas en un solo lugar."
      icon="domain"
      navigationLabel="Secciones de configuración de la empresa"
      [items]="visibleNavigationItems()"
      [tourEnabled]="false"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class EmpresaShellComponent {
  private readonly authorization = inject(AuthorizationService);
  private readonly navigationItems: readonly CompanyNavItem[] = [
    { label: 'Información general', icon: 'business', route: '/workspace/empresa/general', resource: 'empresa_general' },
    { label: 'Calendario', icon: 'calendar_month', route: '/workspace/empresa/calendario', resource: 'empresa_calendario' },
    { label: 'Módulos', icon: 'apps', route: '/workspace/empresa/modulos', resource: 'empresa_modulos' },
    { label: 'Colaboradores', icon: 'groups', route: '/workspace/empresa/colaboradores', resource: 'empresa_colaboradores' },
    { label: 'Roles', icon: 'admin_panel_settings', route: '/workspace/empresa/roles', resource: 'empresa_roles' },
    { label: 'Auditoría', icon: 'manage_search', route: '/workspace/empresa/auditoria', resource: 'empresa_auditoria' },
    { label: 'Mis notificaciones', icon: 'notifications_active', route: '/workspace/empresa/notificaciones', resource: 'empresa_notificaciones' }
  ];
  protected readonly visibleNavigationItems = computed<readonly ModuleNavItem[]>(() =>
    this.navigationItems.filter(item => this.authorization.canAccess(item.resource, 'read'))
  );
}

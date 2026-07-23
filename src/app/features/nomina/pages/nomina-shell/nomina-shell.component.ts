import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-nomina-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="nomina"
      eyebrow="Gestión de personal"
      title="Nómina"
      description="Administra empleados, roles de pago, rubros y configuración contable de la nómina."
      icon="payments"
      navigationLabel="Navegación de nómina"
      [tourEnabled]="false"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class NominaShellComponent {
  private readonly router = inject(Router);
  private readonly baseRoute = this.router.url.startsWith('/workspace/contabilidad/nomina')
    ? '/workspace/contabilidad/nomina'
    : '/workspace/nomina';

  /**
   * La configuración contable de nómina (cuentas, IESS, provisiones) vive en la página de
   * Configuración de Contabilidad, no aquí: este ítem enlaza directo a ese panel. El ítem local
   * cubre solo los campos personalizados del empleado, y se nombra como tal para no confundirlos.
   */
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Roles de pago', icon: 'receipt_long', route: `${this.baseRoute}/roles` },
    { label: 'Empleados', icon: 'badge', route: `${this.baseRoute}/empleados` },
    { label: 'Provisiones', icon: 'savings', route: `${this.baseRoute}/provisiones` },
    { label: 'Utilidades', icon: 'groups', route: `${this.baseRoute}/utilidades` },
    { label: 'Rubros', icon: 'category', route: `${this.baseRoute}/rubros` },
    { label: 'Campos de empleado', icon: 'list_alt', route: `${this.baseRoute}/configuracion` },
    {
      label: 'Configuración contable',
      icon: 'tune',
      route: '/workspace/contabilidad/configuracion',
      queryParams: { tab: 'integraciones', panel: 'nomina' },
    },
  ];
}

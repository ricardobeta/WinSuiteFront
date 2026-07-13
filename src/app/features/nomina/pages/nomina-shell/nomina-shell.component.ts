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

  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Roles de pago', icon: 'receipt_long', route: `${this.baseRoute}/roles` },
    { label: 'Empleados', icon: 'badge', route: `${this.baseRoute}/empleados` },
    { label: 'Rubros', icon: 'category', route: `${this.baseRoute}/rubros` },
    { label: 'Configuración', icon: 'tune', route: `${this.baseRoute}/configuracion` },
  ];
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-servicios-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="servicios"
      eyebrow="Módulo Servicios"
      title="Servicios"
      description="Gestiona el catálogo de servicios, precios y configuraciones de tu operación comercial."
      icon="home_repair_service"
      navigationLabel="Navegación de servicios"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class ServiciosShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Lista', icon: 'home_repair_service', route: '/workspace/servicios/lista' },
    { label: 'Configuración', icon: 'tune', route: '/workspace/servicios/configuracion' },
  ];
}

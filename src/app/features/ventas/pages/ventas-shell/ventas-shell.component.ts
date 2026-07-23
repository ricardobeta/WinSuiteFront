import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';
import { PosImmersiveService } from '../../services/pos-immersive.service';

@Component({
  selector: 'app-ventas-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="ventas"
      eyebrow="Módulo Ventas"
      title="Punto de Venta"
      description="Gestiona cobros, historial de ventas, reversos e indicadores comerciales en tiempo real."
      icon="point_of_sale"
      navigationLabel="Navegación de ventas"
      [items]="navigationItems"
      [immersive]="immersive()"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class VentasShellComponent {
  protected readonly immersive = inject(PosImmersiveService).immersive;

  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'POS', icon: 'point_of_sale', route: '/workspace/ventas/pos' },
    { label: 'Resumen', icon: 'receipt_long', route: '/workspace/ventas/resumen' },
    { label: 'Informes', icon: 'insights', route: '/workspace/ventas/informes' },
    { label: 'Configuración', icon: 'tune', route: '/workspace/ventas/configuracion' },
  ];
}

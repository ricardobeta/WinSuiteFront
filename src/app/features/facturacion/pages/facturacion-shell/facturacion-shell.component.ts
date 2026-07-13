import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-facturacion-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="facturacion"
      eyebrow="Facturación electrónica"
      title="Facturación"
      description="Centraliza firmas, configuración tributaria y documentos electrónicos de la empresa."
      icon="receipt_long"
      navigationLabel="Navegación de facturación"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class FacturacionShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Firmas', icon: 'badge', route: '/workspace/facturacion/firmas' },
    { label: 'SRI', icon: 'cloud_download', route: '/workspace/facturacion/sri' },
    { label: 'Configuración', icon: 'tune', route: '/workspace/facturacion/configuracion' },
  ];
}

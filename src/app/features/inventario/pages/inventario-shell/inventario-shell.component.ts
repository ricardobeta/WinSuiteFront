import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-inventario-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="inventario"
      eyebrow="Módulo Inventario"
      title="Inventario"
      description="Gestiona productos, proveedores, órdenes de compra, existencias y configuración del inventario."
      icon="inventory_2"
      navigationLabel="Navegación de inventario"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class InventarioShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Productos', icon: 'inventory_2', route: '/workspace/inventario/productos' },
    { label: 'Recetas', icon: 'menu_book', route: '/workspace/inventario/recetas' },
    { label: 'Proveedores', icon: 'storefront', route: '/workspace/inventario/proveedores' },
    { label: 'Órdenes de compra', icon: 'shopping_cart_checkout', route: '/workspace/inventario/ordenes-compra' },
    { label: 'Costos', icon: 'monitoring', route: '/workspace/inventario/costos' },
    { label: 'Almacenes', icon: 'warehouse', route: '/workspace/inventario/almacenes' },
    { label: 'Configuración', icon: 'tune', route: '/workspace/inventario/configuracion' },
  ];
}

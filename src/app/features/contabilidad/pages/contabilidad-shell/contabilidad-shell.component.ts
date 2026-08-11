import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';
import { AuthorizationService } from '../../../../core/services/authorization.service';

@Component({
  selector: 'app-contabilidad-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="contabilidad"
      eyebrow="Gestión contable"
      title="Contabilidad"
      description="Organiza tu plan de cuentas, asientos, compras y reportes para tomar decisiones financieras claras."
      icon="account_balance"
      navigationLabel="Navegación de contabilidad"
      [items]="navigationItems()"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class ContabilidadShellComponent {
  private readonly authorization = inject(AuthorizationService);
  private readonly baseNavigationItems: readonly ModuleNavItem[] = [
    { label: 'Plan de cuentas', icon: 'account_tree', route: '/workspace/contabilidad/plan-cuentas' },
    { label: 'Configuración', icon: 'settings', route: '/workspace/contabilidad/configuracion' },
    { label: 'Asientos contables', icon: 'receipt_long', route: '/workspace/contabilidad/asientos' },
    { label: 'Compras', icon: 'shopping_cart', route: '/workspace/contabilidad/compras' },
    { label: 'Cuentas por pagar', icon: 'request_quote', route: '/workspace/contabilidad/cuentas-por-pagar' },
    { label: 'Bancos', icon: 'account_balance_wallet', route: '/workspace/contabilidad/bancos' },
    { label: 'Reportes', icon: 'bar_chart', route: '/workspace/contabilidad/reportes' },
    { label: 'Cumplimiento SRI', icon: 'verified', route: '/workspace/contabilidad/cumplimiento-sri' },
    { label: 'Nómina', icon: 'payments', route: '/workspace/contabilidad/nomina' },
  ];
  protected readonly navigationItems = computed(() => this.baseNavigationItems.filter((item) =>
    item.route !== '/workspace/contabilidad/cumplimiento-sri'
      || this.authorization.canAccess('contabilidad_sri', 'read')));
}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-asistente-ventas-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="asistente_ventas"
      eyebrow="Asistente de ventas"
      title="Administrador WhatsApp"
      description="Gestiona instancias, plantillas, conversaciones y automatizaciones comerciales de cada empresa."
      icon="forum"
      navigationLabel="Navegación del asistente de ventas"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class AsistenteVentasShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Instancias', icon: 'hub', route: '/workspace/asistente-ventas/instancias' },
    { label: 'Plantillas', icon: 'edit_note', route: '/workspace/asistente-ventas/plantillas' },
    { label: 'Flujos', icon: 'schema', route: '/workspace/asistente-ventas/flujos' },
    { label: 'Conversaciones', icon: 'chat', route: '/workspace/asistente-ventas/conversaciones' },
    { label: 'Funnels', icon: 'filter_alt', route: '/workspace/asistente-ventas/funnels' },
    { label: 'Base de conocimiento', icon: 'auto_awesome', route: '/workspace/asistente-ventas/conocimiento' },
  ];
}

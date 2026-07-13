import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-clientes-shell',
  imports: [RouterLink, RouterOutlet, MatButtonModule, MatIconModule, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="clientes"
      eyebrow="Módulo Clientes"
      title="Clientes"
      description="Administra clientes y configura los campos que necesita tu operación comercial."
      icon="groups"
      navigationLabel="Navegación de clientes"
      [items]="navigationItems"
    >
      <div module-hero-actions>
        <a mat-flat-button color="primary" routerLink="/workspace/customers/lista">
          <mat-icon>groups</mat-icon> Ver clientes
        </a>
      </div>
      <router-outlet />
    </app-module-shell>
  `,
})
export class ClientesShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Lista', icon: 'groups', route: '/workspace/customers/lista' },
    { label: 'Configuración', icon: 'tune', route: '/workspace/customers/configuracion' },
  ];
}

import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-colaboradores-shell',
  imports: [RouterLink, RouterOutlet, MatButtonModule, MatIconModule, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="colaboradores"
      eyebrow="Equipo y seguridad"
      title="Colaboradores"
      description="Administra colaboradores, roles y accesos según las responsabilidades de cada equipo."
      icon="group_work"
      navigationLabel="Navegación de colaboradores"
      [items]="navigationItems"
    >
      <div module-hero-actions>
        <a mat-flat-button color="primary" routerLink="/workspace/colaboradores/nuevo">
          <mat-icon>person_add</mat-icon> Nuevo colaborador
        </a>
      </div>
      <router-outlet />
    </app-module-shell>
  `,
})
export class ColaboradoresShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Lista', icon: 'groups', route: '/workspace/colaboradores/lista' },
    { label: 'Roles', icon: 'admin_panel_settings', route: '/workspace/colaboradores/roles' },
  ];
}

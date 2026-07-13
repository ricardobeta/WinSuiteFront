import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModuleNavItem, ModuleShellComponent } from '../../../../shared/components/module-shell/module-shell.component';

@Component({
  selector: 'app-archivos-shell',
  imports: [RouterOutlet, ModuleShellComponent],
  template: `
    <app-module-shell
      moduleId="archivos"
      eyebrow="Administrador de archivos"
      title="Archivos de la empresa"
      description="Centraliza la carga de archivos e imágenes para compartirlas con todo el equipo."
      icon="folder_open"
      navigationLabel="Navegación de archivos"
      [items]="navigationItems"
    >
      <router-outlet />
    </app-module-shell>
  `,
})
export class ArchivosShellComponent {
  protected readonly navigationItems: readonly ModuleNavItem[] = [
    { label: 'Listado', icon: 'folder_open', route: '/workspace/archivos/lista' },
  ];
}

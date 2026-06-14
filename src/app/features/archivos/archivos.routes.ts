import { Routes } from '@angular/router';

import { ArchivosShellComponent } from './pages/archivos-shell/archivos-shell.component';
import { ArchivosListaComponent } from './pages/archivos-lista/archivos-lista.component';

export const ARCHIVOS_ROUTES: Routes = [
  {
    path: '',
    component: ArchivosShellComponent,
    data: {
      module: 'Archivos',
      page: 'Administrador de archivos'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lista'
      },
      {
        path: 'lista',
        component: ArchivosListaComponent,
        data: {
          module: 'Archivos',
          page: 'Listado de archivos'
        }
      },
      {
        path: '**',
        redirectTo: 'lista'
      }
    ]
  }
];

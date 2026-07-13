import { Routes } from '@angular/router';

import { provideSitesFirebase } from '../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../core/services/sites-firebase-session.service';
import { SitioMediaService } from '../sitio-web/services/sitio-media.service';
import { ArchivosShellComponent } from './pages/archivos-shell/archivos-shell.component';
import { ArchivosListaComponent } from './pages/archivos-lista/archivos-lista.component';

export const ARCHIVOS_ROUTES: Routes = [
  {
    path: '',
    component: ArchivosShellComponent,
    providers: [
      ...provideSitesFirebase(),
      SitesFirebaseSessionService,
      SitioMediaService,
    ],
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

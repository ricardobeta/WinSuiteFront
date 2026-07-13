import { Routes } from '@angular/router';
import { provideSitesFirebase } from '../../core/firebase/sites-firebase.tokens';
import { SitesFirebaseSessionService } from '../../core/services/sites-firebase-session.service';
import { CatalogoPublicacionService } from './services/catalogo-publicacion.service';
import { DominioCustomService } from './services/dominio-custom.service';
import { SitioBorradorService } from './services/sitio-borrador.service';
import { SitioConfigService } from './services/sitio-config.service';
import { SitioMediaService } from './services/sitio-media.service';
import { SitioPublicacionService } from './services/sitio-publicacion.service';
import { SitiosService } from './services/sitios.service';

export const SITIO_WEB_ROUTES: Routes = [
  {
    path: '',
    providers: [
      ...provideSitesFirebase(),
      SitesFirebaseSessionService,
      SitiosService,
      SitioBorradorService,
      SitioConfigService,
      DominioCustomService,
      CatalogoPublicacionService,
      SitioPublicacionService,
      SitioMediaService,
    ],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/mis-sitios-page/mis-sitios-page.component').then(
            (c) => c.MisSitiosPageComponent,
          ),
        data: { module: 'Sitio Web', page: 'Mis sitios' },
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./pages/crear-sitio-page/crear-sitio-page.component').then(
            (c) => c.CrearSitioPageComponent,
          ),
        data: { module: 'Sitio Web', page: 'Crear sitio' },
      },
      {
        path: ':sitioId',
        loadComponent: () =>
          import('./pages/sitio-web-shell/sitio-web-shell.component').then(
            (c) => c.SitioWebShellComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'editor' },
          {
            path: 'editor',
            loadComponent: () => import('./pages/editor-page/editor-page.component').then((c) => c.EditorPageComponent),
            data: { module: 'Sitio Web', page: 'Editor' },
          },
          {
            path: 'catalogo',
            loadComponent: () => import('./pages/catalogo-page/catalogo-page.component').then((c) => c.CatalogoPageComponent),
            data: { module: 'Sitio Web', page: 'Catalogo' },
          },
          {
            path: 'pedidos',
            loadComponent: () => import('./pages/pedidos-page/pedidos-page.component').then((c) => c.PedidosPageComponent),
            data: { module: 'Sitio Web', page: 'Pedidos' },
          },
          {
            path: 'formularios',
            loadComponent: () => import('./pages/formularios-page/formularios-page.component').then((c) => c.FormulariosPageComponent),
            data: { module: 'Sitio Web', page: 'Formularios' },
          },
          {
            path: 'formularios/:formId/respuestas',
            loadComponent: () => import('./pages/formularios-page/respuestas-page.component').then((c) => c.RespuestasPageComponent),
            data: { module: 'Sitio Web', page: 'Respuestas' },
          },
          {
            path: 'pagos',
            loadComponent: () => import('./pages/pagos-page/pagos-page.component').then((c) => c.PagosPageComponent),
            data: { module: 'Sitio Web', page: 'Pagos' },
          },
          {
            path: 'configuracion',
            loadComponent: () => import('./pages/configuracion-page/configuracion-page.component').then((c) => c.ConfiguracionPageComponent),
            data: { module: 'Sitio Web', page: 'Configuracion' },
          },
        ],
      },
    ],
  },
];

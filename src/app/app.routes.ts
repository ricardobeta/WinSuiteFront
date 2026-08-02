import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { RegisterPageComponent } from './features/auth/pages/register-page/register-page.component';
import { WorkspacePageComponent } from './features/workspace/pages/workspace-page/workspace-page.component';
import { WorkspaceShellComponent } from './features/workspace/layout/workspace-shell/workspace-shell.component';
import { moduleAccessGuard, platformAdminGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },
  {
    path: 'auth/login',
    component: LoginPageComponent,
  },
  {
    path: 'auth/register',
    component: RegisterPageComponent,
  },
  // Paginas legales publicas. Se entregan a Meta para la verificacion de negocio,
  // por lo que van sin guard y antes del comodin que redirige a login.
  {
    path: 'legal',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'representante-legal',
      },
      {
        path: 'representante-legal',
        loadComponent: () =>
          import('./features/legal/pages/representante-legal/representante-legal.component').then(
            (m) => m.RepresentanteLegalComponent,
          ),
      },
      {
        path: 'privacidad',
        loadComponent: () =>
          import('./features/legal/pages/politica-privacidad/politica-privacidad.component').then(
            (m) => m.PoliticaPrivacidadComponent,
          ),
      },
      {
        path: 'terminos',
        loadComponent: () =>
          import(
            './features/legal/pages/terminos-condiciones/terminos-condiciones.component'
          ).then((m) => m.TerminosCondicionesComponent),
      },
    ],
  },
  // Panel de super administracion: va fuera del workspace porque no tiene empresa activa.
  {
    path: 'super-admin',
    canMatch: [platformAdminGuard],
    loadChildren: () =>
      import('./features/super-admin/super-admin.routes').then((routes) => routes.SUPER_ADMIN_ROUTES),
  },
  {
    path: 'workspace',
    component: WorkspaceShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then(
            (component) => component.DashboardPageComponent,
          ),
        data: {
          module: 'Inicio',
          page: 'Dashboard',
        },
      },
      {
        path: 'customers',
        canMatch: [moduleAccessGuard('clientes', 'read')],
        loadChildren: () =>
          import('./features/clientes/clientes.routes').then((routes) => routes.CLIENTES_ROUTES),
      },
      {
        path: 'facturacion',
        canMatch: [moduleAccessGuard('facturacion', 'read')],
        loadChildren: () =>
          import('./features/facturacion/facturacion.routes').then(
            (routes) => routes.FACTURACION_ROUTES,
          ),
      },
      {
        path: 'inventario',
        canMatch: [moduleAccessGuard('inventario', 'read')],
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then(
            (routes) => routes.INVENTARIO_ROUTES,
          ),
      },
      {
        path: 'contabilidad',
        canMatch: [moduleAccessGuard('contabilidad', 'read')],
        loadChildren: () =>
          import('./features/contabilidad/contabilidad.routes').then(
            (routes) => routes.CONTABILIDAD_ROUTES,
          ),
      },
      {
        path: 'nomina',
        loadChildren: () =>
          import('./features/nomina/nomina.routes').then((routes) => routes.NOMINA_ROUTES),
      },
      {
        path: 'ventas',
        canMatch: [moduleAccessGuard('ventas', 'read')],
        loadChildren: () =>
          import('./features/ventas/ventas.routes').then((routes) => routes.VENTAS_ROUTES),
      },
      {
        path: 'empresa',
        loadChildren: () => import('./features/empresa/empresa.routes').then((routes) => routes.EMPRESA_ROUTES),
      },
      // Sin guard de modulo: cualquier usuario debe poder ver su plan y ampliarlo.
      {
        path: 'planes',
        loadComponent: () =>
          import('./features/planes/pages/planes-page/planes-page.component').then(
            (component) => component.PlanesPageComponent,
          ),
        data: { module: 'Empresa', page: 'Planes y consumo' },
      },
      {
        path: 'colaboradores',
        redirectTo: 'empresa/colaboradores',
        pathMatch: 'full',
      },
      { path: 'colaboradores/lista', redirectTo: 'empresa/colaboradores', pathMatch: 'full' },
      { path: 'colaboradores/nuevo', redirectTo: 'empresa/colaboradores/nuevo', pathMatch: 'full' },
      { path: 'colaboradores/roles', redirectTo: 'empresa/roles', pathMatch: 'full' },
      { path: 'colaboradores/roles/nuevo', redirectTo: 'empresa/roles/nuevo', pathMatch: 'full' },
      { path: 'colaboradores/roles/:id/editar', redirectTo: 'empresa/roles/:id/editar', pathMatch: 'full' },
      { path: 'colaboradores/:id/editar', redirectTo: 'empresa/colaboradores/:id/editar', pathMatch: 'full' },
      {
        path: 'auditoria',
        redirectTo: 'empresa/auditoria',
        pathMatch: 'full',
      },
      {
        path: 'archivos',
        canMatch: [moduleAccessGuard('archivos', 'read')],
        loadChildren: () =>
          import('./features/archivos/archivos.routes').then((routes) => routes.ARCHIVOS_ROUTES),
      },
      {
        path: 'servicios',
        canMatch: [moduleAccessGuard('servicios', 'read')],
        loadChildren: () =>
          import('./features/servicios/servicios.routes').then((routes) => routes.SERVICIOS_ROUTES),
      },
      {
        path: 'asistente-ventas',
        canMatch: [moduleAccessGuard('asistente_ventas', 'read')],
        loadChildren: () =>
          import('./features/asistente-ventas/asistente-ventas.routes').then(
            (routes) => routes.ASISTENTE_VENTAS_ROUTES,
          ),
      },
      {
        path: 'sitio-web',
        canMatch: [moduleAccessGuard('sitio_web', 'read')],
        loadChildren: () =>
          import('./features/sitio-web/sitio-web.routes').then((routes) => routes.SITIO_WEB_ROUTES),
      },
      {
        path: 'products',
        redirectTo: 'ventas/pos',
      },
      {
        path: 'orders',
        redirectTo: 'ventas/resumen',
      },
      {
        path: 'reports',
        redirectTo: 'ventas/informes',
      },
      {
        path: 'projects',
        component: WorkspacePageComponent,
        data: {
          module: 'Proyectos',
          page: 'Kanban',
        },
      },
      {
        path: 'configuracion',
        redirectTo: 'empresa/general',
        pathMatch: 'full',
      },
      { path: 'configuracion/modulos', redirectTo: 'empresa/modulos', pathMatch: 'full' },
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];

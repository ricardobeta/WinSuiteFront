import { Routes } from '@angular/router';

import { SuperAdminShellComponent } from './layout/super-admin-shell/super-admin-shell.component';

/**
 * Panel de super administracion. Cuelga fuera del workspace porque el super administrador no
 * tiene empresa activa. La autorizacion real la impone el backend en /api/platform/**.
 */
export const SUPER_ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: SuperAdminShellComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'empresas' },
      {
        path: 'empresas',
        loadComponent: () =>
          import('./pages/empresas-list/empresas-list.component').then((m) => m.EmpresasListComponent),
        data: { module: 'Plataforma', page: 'Empresas' },
      },
      {
        path: 'empresas/:tenantId',
        loadComponent: () =>
          import('./pages/empresa-detalle/empresa-detalle.component').then((m) => m.EmpresaDetalleComponent),
        data: { module: 'Plataforma', page: 'Detalle de empresa' },
      },
      {
        path: 'cuentas',
        loadComponent: () =>
          import('./pages/cuentas-list/cuentas-list.component').then((m) => m.CuentasListComponent),
        data: { module: 'Plataforma', page: 'Cuentas' },
      },
      {
        path: 'planes-empresa',
        loadComponent: () =>
          import('./pages/planes-empresa/planes-empresa.component').then((m) => m.PlanesEmpresaComponent),
        data: { module: 'Plataforma', page: 'Planes por empresa' },
      },
      {
        path: 'planes-cuenta',
        loadComponent: () =>
          import('./pages/planes-cuenta/planes-cuenta.component').then((m) => m.PlanesCuentaComponent),
        data: { module: 'Plataforma', page: 'Planes por cuenta' },
      },
      {
        path: 'complementos',
        loadComponent: () =>
          import('./pages/complementos/complementos.component').then((m) => m.ComplementosComponent),
        data: { module: 'Plataforma', page: 'Complementos' },
      },
      {
        path: 'ordenes',
        loadComponent: () => import('./pages/ordenes/ordenes.component').then((m) => m.OrdenesComponent),
        data: { module: 'Plataforma', page: 'Ordenes de compra' },
      },
      {
        path: 'ajustes-pago',
        loadComponent: () =>
          import('./pages/ajustes-pago/ajustes-pago.component').then((m) => m.AjustesPagoComponent),
        data: { module: 'Plataforma', page: 'Ajustes de cobro' },
      },
    ],
  },
];

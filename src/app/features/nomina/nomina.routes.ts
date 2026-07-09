import { Routes } from '@angular/router';

export const NOMINA_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '/workspace/contabilidad/nomina'
  },
  {
    path: 'roles',
    pathMatch: 'full',
    redirectTo: '/workspace/contabilidad/nomina/roles'
  },
  {
    path: 'roles/:id',
    redirectTo: '/workspace/contabilidad/nomina/roles/:id'
  },
  {
    path: 'empleados',
    pathMatch: 'full',
    redirectTo: '/workspace/contabilidad/nomina/empleados'
  },
  {
    path: 'empleados/nuevo',
    redirectTo: '/workspace/contabilidad/nomina/empleados/nuevo'
  },
  {
    path: 'empleados/:id/editar',
    redirectTo: '/workspace/contabilidad/nomina/empleados/:id/editar'
  },
  {
    path: 'rubros',
    redirectTo: '/workspace/contabilidad/nomina/rubros'
  },
  {
    path: 'configuracion',
    redirectTo: '/workspace/contabilidad/nomina/configuracion'
  },
  {
    path: '**',
    redirectTo: '/workspace/contabilidad/nomina'
  }
];

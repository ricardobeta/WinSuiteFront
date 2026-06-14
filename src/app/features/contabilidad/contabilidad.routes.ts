import { Routes } from '@angular/router';

import { ContabilidadShellComponent } from './pages/contabilidad-shell/contabilidad-shell.component';
import { PlanCuentasComponent } from './pages/plan-cuentas/plan-cuentas.component';
import { AsientosListComponent } from './pages/asientos-list/asientos-list.component';
import { AsientoFormComponent } from './pages/asiento-form/asiento-form.component';
import { ConfiguracionContableComponent } from './pages/configuracion-contable/configuracion-contable.component';
import { ReportesContablesComponent } from './pages/reportes-contables/reportes-contables.component';

export const CONTABILIDAD_ROUTES: Routes = [
  {
    path: '',
    component: ContabilidadShellComponent,
    data: {
      module: 'Contabilidad',
      page: 'Modulo de contabilidad'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'plan-cuentas'
      },
      {
        path: 'plan-cuentas',
        component: PlanCuentasComponent,
        data: {
          module: 'Contabilidad',
          page: 'Plan de cuentas'
        }
      },
      {
        path: 'configuracion',
        component: ConfiguracionContableComponent,
        data: {
          module: 'Contabilidad',
          page: 'Configuracion contable'
        }
      },
      {
        path: 'asientos',
        component: AsientosListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Asientos manuales'
        }
      },
      {
        path: 'asientos/nuevo',
        component: AsientoFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Nuevo asiento'
        }
      },
      {
        path: 'asientos/:id/editar',
        component: AsientoFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Editar asiento'
        }
      },
      {
        path: 'reportes',
        component: ReportesContablesComponent,
        data: {
          module: 'Contabilidad',
          page: 'Reportes contables'
        }
      },
      {
        path: '**',
        redirectTo: 'plan-cuentas'
      }
    ]
  }
];

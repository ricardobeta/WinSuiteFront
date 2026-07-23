import { Routes } from '@angular/router';

import { ContabilidadShellComponent } from './pages/contabilidad-shell/contabilidad-shell.component';
import { PlanCuentasComponent } from './pages/plan-cuentas/plan-cuentas.component';
import { AsientosListComponent } from './pages/asientos-list/asientos-list.component';
import { AsientoFormComponent } from './pages/asiento-form/asiento-form.component';
import { ConfiguracionContableComponent } from './pages/configuracion-contable/configuracion-contable.component';
import { TiposGastoCompraComponent } from './pages/tipos-gasto/tipos-gasto-compra.component';
import { CxpConfiguracionComponent } from './pages/cxp-configuracion/cxp-configuracion.component';
import { CuentasPorPagarListComponent } from './pages/cuentas-por-pagar-list/cuentas-por-pagar-list.component';
import { CuentaPorPagarFormComponent } from './pages/cuenta-por-pagar-form/cuenta-por-pagar-form.component';
import { PagosProveedorListComponent } from './pages/pagos-proveedor-list/pagos-proveedor-list.component';
import { PagoProveedorFormComponent } from './pages/pago-proveedor-form/pago-proveedor-form.component';
import { CxpAgingComponent } from './pages/cxp-aging/cxp-aging.component';
import { ReportesContablesComponent } from './pages/reportes-contables/reportes-contables.component';
import { FacturasCompraListComponent } from './pages/facturas-compra-list/facturas-compra-list.component';
import { FacturaCompraFormComponent } from './pages/factura-compra-form/factura-compra-form.component';
import { CargaMasivaComprasComponent } from './pages/carga-masiva-compras/carga-masiva-compras.component';
import { AtsGenerarComponent } from './pages/ats-generar/ats-generar.component';
import { BancosCuentasListComponent } from './pages/bancos/bancos-cuentas-list.component';
import { ExtractoImportComponent } from './pages/bancos/extracto-import.component';
import { BancosMovimientosListComponent } from './pages/bancos/bancos-movimientos-list.component';
import { ConciliacionWorkspaceComponent } from './pages/bancos/conciliacion-workspace.component';
import { BancosReglasComponent } from './pages/bancos/bancos-reglas.component';
import { TesoreriaListComponent } from './pages/bancos/tesoreria-list.component';
import { BancosDashboardComponent } from './pages/bancos/bancos-dashboard.component';
import { NominaShellComponent } from '../nomina/pages/nomina-shell/nomina-shell.component';
import { NominaRolesComponent } from './pages/nomina-roles/nomina-roles.component';
import { NominaRolDetalleComponent } from '../nomina/pages/rol-detalle/nomina-rol-detalle.component';
import { NominaLiquidacionComponent } from '../nomina/pages/liquidacion/nomina-liquidacion.component';
import { NominaProvisionesComponent } from '../nomina/pages/provisiones/nomina-provisiones.component';
import { NominaUtilidadesComponent } from '../nomina/pages/utilidades/nomina-utilidades.component';
import { NominaRubrosComponent } from '../nomina/pages/rubros/nomina-rubros.component';
import { NominaEmpleadosListComponent } from '../nomina/pages/empleados-list/nomina-empleados-list.component';
import { NominaEmpleadoFormComponent } from '../nomina/pages/empleado-form/nomina-empleado-form.component';
import { NominaCamposEmpleadoConfiguracionComponent } from './pages/nomina-configuracion/nomina-campos-empleado-configuracion.component';

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
        path: 'configuracion/tipos-gasto',
        component: TiposGastoCompraComponent,
        data: {
          module: 'Contabilidad',
          page: 'Tipos de gasto'
        }
      },
      {
        path: 'configuracion/cuentas-por-pagar',
        component: CxpConfiguracionComponent,
        data: {
          module: 'Contabilidad',
          page: 'Configuracion de cuentas por pagar'
        }
      },
      {
        path: 'asientos',
        component: AsientosListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Asientos contables'
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
        path: 'compras',
        component: FacturasCompraListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Facturas de compra'
        }
      },
      {
        path: 'compras/nueva',
        component: FacturaCompraFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Nueva factura de compra'
        }
      },
      {
        path: 'compras/carga-masiva',
        component: CargaMasivaComprasComponent,
        data: {
          module: 'Contabilidad',
          page: 'Carga masiva de compras'
        }
      },
      {
        path: 'compras/:id/editar',
        component: FacturaCompraFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Editar factura de compra'
        }
      },
      {
        path: 'cuentas-por-pagar/nueva',
        component: CuentaPorPagarFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Nueva cuenta por pagar'
        }
      },
      {
        path: 'cuentas-por-pagar/pagos/nuevo',
        component: PagoProveedorFormComponent,
        data: {
          module: 'Contabilidad',
          page: 'Nuevo pago a proveedor'
        }
      },
      {
        path: 'cuentas-por-pagar/pagos',
        component: PagosProveedorListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Pagos a proveedor'
        }
      },
      {
        path: 'cuentas-por-pagar/antiguedad',
        component: CxpAgingComponent,
        data: {
          module: 'Contabilidad',
          page: 'Antiguedad de saldos'
        }
      },
      {
        path: 'cuentas-por-pagar',
        component: CuentasPorPagarListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Cuentas por pagar'
        }
      },
      {
        path: 'ats',
        component: AtsGenerarComponent,
        data: {
          module: 'Contabilidad',
          page: 'Generar ATS'
        }
      },
      {
        path: 'bancos',
        component: BancosCuentasListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Cuentas bancarias'
        }
      },
      {
        path: 'bancos/extractos/importar',
        component: ExtractoImportComponent,
        data: {
          module: 'Contabilidad',
          page: 'Importar extracto bancario'
        }
      },
      {
        path: 'bancos/movimientos',
        component: BancosMovimientosListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Movimientos bancarios'
        }
      },
      {
        path: 'bancos/conciliacion',
        component: ConciliacionWorkspaceComponent,
        data: {
          module: 'Contabilidad',
          page: 'Conciliacion bancaria'
        }
      },
      {
        path: 'bancos/configuracion/reglas',
        component: BancosReglasComponent,
        data: {
          module: 'Contabilidad',
          page: 'Reglas de conciliacion'
        }
      },
      {
        path: 'bancos/tesoreria',
        component: TesoreriaListComponent,
        data: {
          module: 'Contabilidad',
          page: 'Tesoreria'
        }
      },
      {
        path: 'bancos/dashboard',
        component: BancosDashboardComponent,
        data: {
          module: 'Contabilidad',
          page: 'Dashboard de bancos'
        }
      },
      {
        path: 'nomina',
        component: NominaShellComponent,
        data: {
          module: 'Contabilidad',
          page: 'Nomina'
        },
        children: [
          {
            path: '',
            pathMatch: 'full',
            redirectTo: 'roles'
          },
          {
            path: 'roles',
            component: NominaRolesComponent,
            data: {
              module: 'Contabilidad',
              page: 'Roles de pago'
            }
          },
          {
            path: 'roles/:id',
            component: NominaRolDetalleComponent,
            data: {
              module: 'Contabilidad',
              page: 'Detalle de rol de pago'
            }
          },
          {
            path: 'empleados',
            component: NominaEmpleadosListComponent,
            data: {
              module: 'Contabilidad',
              page: 'Empleados de nomina'
            }
          },
          {
            path: 'empleados/nuevo',
            component: NominaEmpleadoFormComponent,
            data: {
              module: 'Contabilidad',
              page: 'Nuevo empleado de nomina'
            }
          },
          {
            path: 'empleados/:id/editar',
            component: NominaEmpleadoFormComponent,
            data: {
              module: 'Contabilidad',
              page: 'Editar empleado de nomina'
            }
          },
          {
            path: 'empleados/:id/liquidar',
            component: NominaLiquidacionComponent,
            data: {
              module: 'Contabilidad',
              page: 'Liquidacion de empleado'
            }
          },
          {
            path: 'utilidades',
            component: NominaUtilidadesComponent,
            data: {
              module: 'Contabilidad',
              page: 'Utilidades'
            }
          },
          {
            path: 'provisiones',
            component: NominaProvisionesComponent,
            data: {
              module: 'Contabilidad',
              page: 'Provisiones de nomina'
            }
          },
          {
            path: 'rubros',
            component: NominaRubrosComponent,
            data: {
              module: 'Contabilidad',
              page: 'Rubros de nomina'
            }
          },
          {
            path: 'configuracion',
            component: NominaCamposEmpleadoConfiguracionComponent,
            data: {
              module: 'Contabilidad',
              page: 'Configuracion de empleados de nomina'
            }
          },
          {
            path: '**',
            redirectTo: 'roles'
          }
        ]
      },
      {
        path: '**',
        redirectTo: 'plan-cuentas'
      }
    ]
  }
];

import { Routes } from '@angular/router';

import { VentasShellComponent } from './pages/ventas-shell/ventas-shell.component';
import { VentasPosComponent } from './pages/ventas-pos/ventas-pos.component';
import { VentasResumenComponent } from './pages/ventas-resumen/ventas-resumen.component';
import { VentaDetalleComponent } from './pages/venta-detalle/venta-detalle.component';
import { VentasInformesComponent } from './pages/ventas-informes/ventas-informes.component';
import { VentasConfiguracionComponent } from './pages/ventas-configuracion/ventas-configuracion.component';

export const VENTAS_ROUTES: Routes = [
  {
    path: '',
    component: VentasShellComponent,
    data: {
      module: 'Ventas',
      page: 'Modulo de ventas'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'pos'
      },
      {
        path: 'pos',
        component: VentasPosComponent,
        data: {
          module: 'Ventas',
          page: 'Punto de venta'
        }
      },
      {
        path: 'resumen',
        component: VentasResumenComponent,
        data: {
          module: 'Ventas',
          page: 'Resumen de ventas'
        }
      },
      {
        path: 'resumen/:id',
        component: VentaDetalleComponent,
        data: {
          module: 'Ventas',
          page: 'Detalle de venta'
        }
      },
      {
        path: 'informes',
        component: VentasInformesComponent,
        data: {
          module: 'Ventas',
          page: 'Informes'
        }
      },
      {
        path: 'configuracion',
        component: VentasConfiguracionComponent,
        data: {
          module: 'Ventas',
          page: 'Configuración'
        }
      },
      {
        path: '**',
        redirectTo: 'pos'
      }
    ]
  }
];

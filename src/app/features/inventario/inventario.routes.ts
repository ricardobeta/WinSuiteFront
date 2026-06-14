import { Routes } from '@angular/router';

import { InventarioShellComponent } from './pages/inventario-shell/inventario-shell.component';
import { ProductosListComponent } from './pages/productos-list/productos-list.component';
import { ProductoFormComponent } from './pages/producto-form/producto-form.component';
import { ProductoKardexComponent } from './pages/producto-kardex/producto-kardex.component';
import { ProveedoresListComponent } from './pages/proveedores-list/proveedores-list.component';
import { ProveedorFormComponent } from './pages/proveedor-form/proveedor-form.component';
import { OrdenesCompraListComponent } from './pages/ordenes-compra-list/ordenes-compra-list.component';
import { OrdenesCompraKanbanComponent } from './pages/ordenes-compra-kanban/ordenes-compra-kanban.component';
import { OrdenCompraFormComponent } from './pages/orden-compra-form/orden-compra-form.component';
import { OrdenCompraRecepcionComponent } from './pages/orden-compra-recepcion/orden-compra-recepcion.component';
import { CostosComponent } from './pages/costos/costos.component';
import { AlmacenesComponent } from './pages/almacenes/almacenes.component';
import { ConfiguracionComponent } from './pages/configuracion/configuracion.component';
import { RecetaAuditoriaComponent } from './pages/receta-auditoria/receta-auditoria.component';
import { RecetasListComponent } from './pages/recetas-list/recetas-list.component';

export const INVENTARIO_ROUTES: Routes = [
  {
    path: '',
    component: InventarioShellComponent,
    data: {
      module: 'Inventario',
      page: 'Modulo de inventario'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'productos'
      },
      {
        path: 'productos',
        component: ProductosListComponent,
        data: {
          module: 'Inventario',
          page: 'Productos'
        }
      },
      {
        path: 'recetas',
        component: RecetasListComponent,
        data: {
          module: 'Inventario',
          page: 'Recetas'
        }
      },
      {
        path: 'productos/new',
        component: ProductoFormComponent,
        data: {
          module: 'Inventario',
          page: 'Nuevo producto'
        }
      },
      {
        path: 'productos/:id/editar',
        component: ProductoFormComponent,
        data: {
          module: 'Inventario',
          page: 'Editar producto'
        }
      },
      {
        path: 'productos/:id/kardex',
        component: ProductoKardexComponent,
        data: {
          module: 'Inventario',
          page: 'Kardex producto'
        }
      },
      {
        path: 'productos/:id/auditoria-receta',
        component: RecetaAuditoriaComponent,
        data: {
          module: 'Inventario',
          page: 'Auditoria receta'
        }
      },
      {
        path: 'proveedores',
        component: ProveedoresListComponent,
        data: {
          module: 'Inventario',
          page: 'Proveedores'
        }
      },
      {
        path: 'proveedores/new',
        component: ProveedorFormComponent,
        data: {
          module: 'Inventario',
          page: 'Nuevo proveedor'
        }
      },
      {
        path: 'proveedores/:id/editar',
        component: ProveedorFormComponent,
        data: {
          module: 'Inventario',
          page: 'Editar proveedor'
        }
      },
      {
        path: 'ordenes-compra',
        component: OrdenesCompraListComponent,
        data: {
          module: 'Inventario',
          page: 'Ordenes de compra'
        }
      },
      {
        path: 'ordenes-compra/kanban',
        component: OrdenesCompraKanbanComponent,
        data: {
          module: 'Inventario',
          page: 'Kanban ordenes de compra'
        }
      },
      {
        path: 'ordenes-compra/new',
        component: OrdenCompraFormComponent,
        data: {
          module: 'Inventario',
          page: 'Nueva orden de compra'
        }
      },
      {
        path: 'ordenes-compra/:id/ver',
        component: OrdenCompraFormComponent,
        data: {
          module: 'Inventario',
          page: 'Detalle orden de compra'
        }
      },
      {
        path: 'ordenes-compra/:id/editar',
        component: OrdenCompraFormComponent,
        data: {
          module: 'Inventario',
          page: 'Editar orden de compra'
        }
      },
      {
        path: 'ordenes-compra/:id/recibir',
        component: OrdenCompraRecepcionComponent,
        data: {
          module: 'Inventario',
          page: 'Recepcion de orden de compra'
        }
      },
      {
        path: 'costos',
        component: CostosComponent,
        data: {
          module: 'Inventario',
          page: 'Costos'
        }
      },
      {
        path: 'almacenes',
        component: AlmacenesComponent,
        data: {
          module: 'Inventario',
          page: 'Almacenes'
        }
      },
      {
        path: 'configuracion',
        component: ConfiguracionComponent,
        data: {
          module: 'Inventario',
          page: 'Configuracion'
        }
      },
      {
        path: '**',
        redirectTo: 'productos'
      }
    ]
  }
];

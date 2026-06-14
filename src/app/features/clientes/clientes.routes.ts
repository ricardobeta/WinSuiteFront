import { Routes } from '@angular/router';

import { ClientesShellComponent } from './pages/clientes-shell/clientes-shell.component';
import { ListaClientesComponent } from './pages/lista-clientes/lista-clientes.component';
import { ConfiguracionClientesComponent } from './pages/configuracion-clientes/configuracion-clientes.component';

export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    component: ClientesShellComponent,
    data: {
      module: 'Clientes',
      page: 'Módulo de clientes'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lista'
      },
      {
        path: 'lista',
        component: ListaClientesComponent,
        data: {
          module: 'Clientes',
          page: 'Lista de clientes'
        }
      },
      {
        path: 'configuracion',
        component: ConfiguracionClientesComponent,
        data: {
          module: 'Clientes',
          page: 'Configuración de clientes'
        }
      },
      {
        path: '**',
        redirectTo: 'lista'
      }
    ]
  }
];
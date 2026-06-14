import { Routes } from '@angular/router';
import { ServiciosShellComponent } from './pages/servicios-shell/servicios-shell.component';
import { ListaServiciosComponent } from './pages/lista-servicios/lista-servicios.component';
import { CrearServicioComponent } from './pages/crear-servicio/crear-servicio.component';
import { ConfiguracionServiciosComponent } from './pages/configuracion-servicios/configuracion-servicios.component';

export const SERVICIOS_ROUTES: Routes = [
  {
    path: '',
    component: ServiciosShellComponent,
    data: {
      module: 'Servicios',
      page: 'Módulo de servicios'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lista'
      },
      {
        path: 'lista',
        component: ListaServiciosComponent,
        data: {
          module: 'Servicios',
          page: 'Lista de servicios'
        }
      },
      {
        path: 'crear',
        component: CrearServicioComponent,
        data: {
          module: 'Servicios',
          page: 'Crear servicio'
        }
      },
      {
        path: 'configuracion',
        component: ConfiguracionServiciosComponent,
        data: {
          module: 'Servicios',
          page: 'Configuracion de servicios'
        }
      },
      {
        path: 'editar/:id',
        component: CrearServicioComponent,
        data: {
          module: 'Servicios',
          page: 'Editar servicio'
        }
      },
      {
        path: '**',
        redirectTo: 'lista'
      }
    ]
  }
];

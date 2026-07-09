import { Routes } from '@angular/router';

import { AsistenteVentasShellComponent } from './pages/asistente-ventas-shell/asistente-ventas-shell.component';
import { InstanciasComponent } from './pages/instancias/instancias.component';
import { PlantillasComponent } from './pages/plantillas/plantillas.component';
import { FlujosBuilderComponent } from './pages/flujos-builder/flujos-builder.component';
import { ConversacionesComponent } from './pages/conversaciones/conversaciones.component';
import { FunnelsComponent } from './pages/funnels/funnels.component';
import { BaseConocimientoComponent } from './pages/base-conocimiento/base-conocimiento.component';

export const ASISTENTE_VENTAS_ROUTES: Routes = [
  {
    path: '',
    component: AsistenteVentasShellComponent,
    data: {
      module: 'Asistente Ventas',
      page: 'Administracion WhatsApp'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'instancias'
      },
      {
        path: 'instancias',
        component: InstanciasComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Instancias WhatsApp'
        }
      },
      {
        path: 'plantillas',
        component: PlantillasComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Plantillas'
        }
      },
      {
        path: 'flujos',
        component: FlujosBuilderComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Constructor de flujos'
        }
      },
      {
        path: 'conversaciones',
        component: ConversacionesComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Conversaciones'
        }
      },
      {
        path: 'funnels',
        component: FunnelsComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Funnels de conversion'
        }
      },
      {
        path: 'conocimiento',
        component: BaseConocimientoComponent,
        data: {
          module: 'Asistente Ventas',
          page: 'Base de conocimiento'
        }
      },
      {
        path: '**',
        redirectTo: 'instancias'
      }
    ]
  }
];

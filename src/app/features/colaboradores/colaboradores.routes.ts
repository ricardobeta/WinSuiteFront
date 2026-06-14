import { Routes } from '@angular/router';

import { ColaboradorFormComponent } from './pages/colaborador-form/colaborador-form.component';
import { ColaboradoresShellComponent } from './pages/colaboradores-shell/colaboradores-shell.component';
import { ListaColaboradoresComponent } from './pages/lista-colaboradores/lista-colaboradores.component';
import { RolesColaboradoresComponent } from './pages/roles-colaboradores/roles-colaboradores.component';
import { RoleFormComponent } from './pages/role-form/role-form.component';

export const COLABORADORES_ROUTES: Routes = [
  {
    path: '',
    component: ColaboradoresShellComponent,
    data: {
      module: 'Colaboradores',
      page: 'Modulo de colaboradores'
    },
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lista'
      },
      {
        path: 'lista',
        component: ListaColaboradoresComponent,
        data: {
          module: 'Colaboradores',
          page: 'Lista de colaboradores'
        }
      },
      {
        path: 'nuevo',
        component: ColaboradorFormComponent,
        data: {
          module: 'Colaboradores',
          page: 'Crear colaborador'
        }
      },
      {
        path: ':id/editar',
        component: ColaboradorFormComponent,
        data: {
          module: 'Colaboradores',
          page: 'Editar colaborador'
        }
      },
      {
        path: 'roles',
        component: RolesColaboradoresComponent,
        data: {
          module: 'Colaboradores',
          page: 'Gestión de Roles'
        }
      },
      {
        path: 'roles/nuevo',
        component: RoleFormComponent,
        data: {
          module: 'Colaboradores',
          page: 'Crear Rol'
        }
      },
      {
        path: 'roles/:id/editar',
        component: RoleFormComponent,
        data: {
          module: 'Colaboradores',
          page: 'Editar Rol'
        }
      },
      {
        path: '**',
        redirectTo: 'lista'
      }
    ]
  }
];

import { Routes } from '@angular/router';

import { moduleAccessGuard } from '../../core/guards/permission.guard';
import { AuditoriaPageComponent } from '../auditoria/pages/auditoria-page/auditoria-page.component';
import { ColaboradorFormComponent } from '../colaboradores/pages/colaborador-form/colaborador-form.component';
import { ListaColaboradoresComponent } from '../colaboradores/pages/lista-colaboradores/lista-colaboradores.component';
import { RoleFormComponent } from '../colaboradores/pages/role-form/role-form.component';
import { RolesColaboradoresComponent } from '../colaboradores/pages/roles-colaboradores/roles-colaboradores.component';
import { ModulosSettingsPageComponent } from '../settings/pages/modulos-settings-page/modulos-settings-page.component';
import { EmpresaCalendarComponent } from './pages/empresa-calendar/empresa-calendar.component';
import { EmpresaGeneralComponent } from './pages/empresa-general/empresa-general.component';
import { EmpresaNotificationsComponent } from './pages/empresa-notifications/empresa-notifications.component';
import { EmpresaShellComponent } from './pages/empresa-shell/empresa-shell.component';

export const EMPRESA_ROUTES: Routes = [{
  path: '',
  component: EmpresaShellComponent,
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'general' },
    { path: 'general', component: EmpresaGeneralComponent, data: { module: 'Empresa', page: 'Informacion general' } },
    { path: 'calendario', canMatch: [moduleAccessGuard('empresa_calendario', 'read')], component: EmpresaCalendarComponent, data: { module: 'Empresa', page: 'Calendario y eventos' } },
    { path: 'modulos', canMatch: [moduleAccessGuard('empresa_modulos', 'read')], component: ModulosSettingsPageComponent, data: { module: 'Empresa', page: 'Modulos' } },
    { path: 'colaboradores', canMatch: [moduleAccessGuard('empresa_colaboradores', 'read')], component: ListaColaboradoresComponent, data: { module: 'Empresa', page: 'Colaboradores' } },
    { path: 'colaboradores/nuevo', canMatch: [moduleAccessGuard('empresa_colaboradores', 'create')], component: ColaboradorFormComponent, data: { module: 'Empresa', page: 'Nuevo colaborador' } },
    { path: 'colaboradores/:id/editar', canMatch: [moduleAccessGuard('empresa_colaboradores', 'update')], component: ColaboradorFormComponent, data: { module: 'Empresa', page: 'Editar colaborador' } },
    { path: 'roles', canMatch: [moduleAccessGuard('empresa_roles', 'read')], component: RolesColaboradoresComponent, data: { module: 'Empresa', page: 'Roles' } },
    { path: 'roles/nuevo', canMatch: [moduleAccessGuard('empresa_roles', 'create')], component: RoleFormComponent, data: { module: 'Empresa', page: 'Nuevo rol' } },
    { path: 'roles/:id/editar', canMatch: [moduleAccessGuard('empresa_roles', 'update')], component: RoleFormComponent, data: { module: 'Empresa', page: 'Editar rol' } },
    { path: 'auditoria', canMatch: [moduleAccessGuard('empresa_auditoria', 'read')], component: AuditoriaPageComponent, data: { module: 'Empresa', page: 'Auditoria' } },
    { path: 'notificaciones', component: EmpresaNotificationsComponent, data: { module: 'Empresa', page: 'Mis notificaciones' } }
  ]
}];

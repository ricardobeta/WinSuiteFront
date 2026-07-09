import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page.component';
import { RegisterPageComponent } from './features/auth/pages/register-page/register-page.component';
import { WorkspacePageComponent } from './features/workspace/pages/workspace-page/workspace-page.component';
import { WorkspaceShellComponent } from './features/workspace/layout/workspace-shell/workspace-shell.component';
import { moduleAccessGuard } from './core/guards/permission.guard';


export const routes: Routes = [
	{
		path: '',
		pathMatch: 'full',
		redirectTo: 'auth/login'
	},
	{
		path: 'auth/login',
		component: LoginPageComponent
	},
	{
		path: 'auth/register',
		component: RegisterPageComponent
	},
	{
		path: 'workspace',
		component: WorkspaceShellComponent,
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'dashboard'
			},
			{
				path: 'dashboard',
				loadComponent: () => import('./features/dashboard/pages/dashboard-page/dashboard-page.component').then((component) => component.DashboardPageComponent),
				data: {
					module: 'Ventas',
					page: 'Dashboard'
				}
			},
			{
				path: 'customers',
				canMatch: [moduleAccessGuard('clientes', 'read')],
				loadChildren: () => import('./features/clientes/clientes.routes').then((routes) => routes.CLIENTES_ROUTES)
			},
			{
				path: 'facturacion',
				canMatch: [moduleAccessGuard('facturacion', 'read')],
				loadChildren: () => import('./features/facturacion/facturacion.routes').then((routes) => routes.FACTURACION_ROUTES)
			},
			{
				path: 'inventario',
				canMatch: [moduleAccessGuard('inventario', 'read')],
				loadChildren: () => import('./features/inventario/inventario.routes').then((routes) => routes.INVENTARIO_ROUTES)
			},
			{
				path: 'contabilidad',
				canMatch: [moduleAccessGuard('contabilidad', 'read')],
				loadChildren: () => import('./features/contabilidad/contabilidad.routes').then((routes) => routes.CONTABILIDAD_ROUTES)
			},
			{
				path: 'nomina',
				loadChildren: () => import('./features/nomina/nomina.routes').then((routes) => routes.NOMINA_ROUTES)
			},
			{
				path: 'ventas',
				canMatch: [moduleAccessGuard('ventas', 'read')],
				loadChildren: () => import('./features/ventas/ventas.routes').then((routes) => routes.VENTAS_ROUTES)
			},
			{
				path: 'colaboradores',
				canMatch: [moduleAccessGuard('colaboradores', 'read')],
				loadChildren: () => import('./features/colaboradores/colaboradores.routes').then((routes) => routes.COLABORADORES_ROUTES)
			},
			{
				path: 'archivos',
				canMatch: [moduleAccessGuard('archivos', 'read')],
				loadChildren: () => import('./features/archivos/archivos.routes').then((routes) => routes.ARCHIVOS_ROUTES)
			},
			{
				path: 'servicios',
				canMatch: [moduleAccessGuard('servicios', 'read')],
				loadChildren: () => import('./features/servicios/servicios.routes').then((routes) => routes.SERVICIOS_ROUTES)
			},
			{
				path: 'asistente-ventas',
				canMatch: [moduleAccessGuard('asistente_ventas', 'read')],
				loadChildren: () => import('./features/asistente-ventas/asistente-ventas.routes').then((routes) => routes.ASISTENTE_VENTAS_ROUTES)
			},
			{
				path: 'products',
				redirectTo: 'ventas/pos'
			},
			{
				path: 'orders',
				redirectTo: 'ventas/resumen'
			},
			{
				path: 'reports',
				redirectTo: 'ventas/informes'
			},
			{
				path: 'projects',
				component: WorkspacePageComponent,
				data: {
					module: 'Proyectos',
					page: 'Kanban'
				}
			},
			{
				path: 'configuracion',
				loadChildren: () => import('./features/settings/settings.routes').then((routes) => routes.SETTINGS_ROUTES)
			}
		]
	},
	{
		path: '**',
		redirectTo: 'auth/login'
	}
];

import { Routes } from '@angular/router';

import { FacturacionShellComponent } from './pages/facturacion-shell/facturacion-shell.component';
import { FirmasPageComponent } from './pages/firmas-page/firmas-page.component';
import { ConfiguracionFacturacionPageComponent } from './pages/configuracion-facturacion-page/configuracion-facturacion-page.component';

export const FACTURACION_ROUTES: Routes = [
	{
		path: '',
		component: FacturacionShellComponent,
		data: {
			module: 'Facturación Electrónica',
			page: 'Módulo de facturación'
		},
		children: [
			{
				path: '',
				pathMatch: 'full',
				redirectTo: 'firmas'
			},
			{
				path: 'firmas',
				component: FirmasPageComponent,
				data: {
					module: 'Facturación Electrónica',
					page: 'Firmas digitales'
				}
			},
			{
				path: 'configuracion',
				component: ConfiguracionFacturacionPageComponent,
				data: {
					module: 'Facturación Electrónica',
					page: 'Configuración'
				}
			},
			{
				path: '**',
				redirectTo: 'firmas'
			}
		]
	}
];
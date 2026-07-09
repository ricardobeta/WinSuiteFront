import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'modulos'
  },
  {
    path: 'modulos',
    loadComponent: () =>
      import('./pages/modulos-settings-page/modulos-settings-page.component').then(
        (component) => component.ModulosSettingsPageComponent
      ),
    data: {
      module: 'Configuracion',
      page: 'Modulos'
    }
  }
];

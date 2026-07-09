import type { DriveStep } from 'driver.js';

export const COLABORADORES_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-colaboradores-header',
    popover: {
      title: 'Colaboradores y roles',
      description: 'Administra colaboradores, roles y accesos segun las responsabilidades de cada equipo. Desde aqui invitas nuevos colaboradores.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-colaboradores-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Lista muestra a tu equipo; Roles te deja definir permisos por modulo para cada rol.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-colaboradores-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la lista de colaboradores o la configuracion de roles, segun la pestana activa.',
      side: 'top',
      align: 'center'
    }
  }
];

import type { DriveStep } from 'driver.js';

export const ARCHIVOS_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-archivos-header',
    popover: {
      title: 'Archivos de la empresa',
      description: 'Centraliza la carga de excels e imagenes para compartirlas con todo tu equipo.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-archivos-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Desde Listado ves y subes los archivos disponibles para tu negocio.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-archivos-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui aparece el listado de archivos subidos por tu equipo.',
      side: 'top',
      align: 'center'
    }
  }
];

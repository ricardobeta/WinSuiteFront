import type { DriveStep } from 'driver.js';

export const SERVICIOS_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-servicios-header',
    popover: {
      title: 'Modulo Servicios',
      description: 'Gestiona el catalogo de servicios, precios y configuraciones que usa tu operacion comercial.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-servicios-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Cambia entre la lista de servicios y su configuracion usando estas pestanas.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-servicios-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion que elijas: la lista de servicios o sus ajustes.',
      side: 'top',
      align: 'center'
    }
  }
];

import type { DriveStep } from 'driver.js';

export const FACTURACION_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-facturacion-header',
    popover: {
      title: 'Facturacion Electronica',
      description: 'Centraliza firmas digitales, configuracion tributaria y la emision de comprobantes autorizados por el SRI.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-facturacion-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui gestionas firmas, descargas del SRI y la configuracion de establecimientos y puntos de emision.',
      side: 'top',
      align: 'center'
    }
  }
];

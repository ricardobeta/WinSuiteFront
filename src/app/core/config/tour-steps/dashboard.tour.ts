import type { DriveStep } from 'driver.js';

export const DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-dashboard-header',
    popover: {
      title: 'Bienvenido a tu Dashboard',
      description: 'Aqui ves de un vistazo las metricas operativas de tu negocio en tiempo real.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-dashboard-grid',
    popover: {
      title: 'Tus widgets',
      description: 'Cada tarjeta es un widget. Puedes moverlos, agregar nuevos o quitarlos entrando en modo edicion.',
      side: 'top',
      align: 'center'
    }
  },
  {
    element: '#tour-dashboard-help',
    popover: {
      title: 'Ayuda cuando la necesites',
      description: 'Si tienes dudas, escribenos por WhatsApp desde este boton en cualquier momento.',
      side: 'left',
      align: 'end'
    }
  }
];

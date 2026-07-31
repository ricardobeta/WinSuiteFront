import type { DriveStep } from 'driver.js';

export const DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-dashboard-header',
    popover: {
      title: 'Bienvenido a tu Dashboard',
      description: 'Aquí ves de un vistazo las métricas operativas de tu negocio en tiempo real.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-dashboard-grid',
    popover: {
      title: 'Tus widgets',
      description: 'Cada tarjeta es un widget. Puedes moverlos, agregar nuevos o quitarlos entrando en modo edición.',
      side: 'top',
      align: 'center'
    }
  },
  {
    element: '.copilot-trigger',
    popover: {
      title: 'Tu asistente de WinSuit',
      description: 'Usa el asistente global cuando necesites ayuda o contexto sobre el negocio.',
      side: 'left',
      align: 'end'
    }
  }
];

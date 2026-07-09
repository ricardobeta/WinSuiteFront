import type { DriveStep } from 'driver.js';

export const VENTAS_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-ventas-header',
    popover: {
      title: 'Punto de Venta',
      description: 'Gestiona cobros de mostrador, historial de ventas, reversos e indicadores comerciales en tiempo real.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-ventas-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'POS para vender, Resumen e Informes para revisar resultados, y Configuracion para ajustar el modulo.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-ventas-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion que elijas, empezando por el punto de venta.',
      side: 'top',
      align: 'center'
    }
  }
];

import type { DriveStep } from 'driver.js';

export const ASISTENTE_VENTAS_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-asistente_ventas-header',
    popover: {
      title: 'Asistente de Ventas por WhatsApp',
      description: 'Gestiona instancias, plantillas, automatizaciones de flujo y funnels de conversion con inteligencia artificial.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-asistente_ventas-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Instancias conecta tu WhatsApp; Plantillas y Flujos definen las automatizaciones; Conversaciones, Funnels y Base de conocimiento te dan visibilidad y control.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-asistente_ventas-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion que elijas dentro del asistente de ventas.',
      side: 'top',
      align: 'center'
    }
  }
];

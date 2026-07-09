import type { DriveStep } from 'driver.js';

export const CLIENTES_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-clientes-header',
    popover: {
      title: 'Modulo Clientes',
      description: 'Aqui administras la cartera de clientes de tu negocio y los campos personalizados que necesites.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-clientes-actions',
    popover: {
      title: 'Accesos rapidos',
      description: 'Desde aqui entras directo a la lista de clientes o a la configuracion de campos personalizados.',
      side: 'bottom',
      align: 'end'
    }
  },
  {
    element: '#tour-clientes-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Cambia entre la lista de clientes y la configuracion usando estas pestanas.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-clientes-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion que elijas: la lista de clientes o sus ajustes.',
      side: 'top',
      align: 'center'
    }
  }
];

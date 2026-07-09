import type { DriveStep } from 'driver.js';

export const CONTABILIDAD_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-contabilidad-header',
    popover: {
      title: 'Gestion contable',
      description: 'Organiza tu plan de cuentas, asientos, periodos y reportes para tomar decisiones con informacion financiera clara.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-contabilidad-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Plan de cuentas, Configuracion, Asientos, Compras, Reportes, ATS y Nomina: cada pestana te lleva a su seccion contable.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-contabilidad-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion contable que elijas.',
      side: 'top',
      align: 'center'
    }
  }
];

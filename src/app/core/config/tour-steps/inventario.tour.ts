import type { DriveStep } from 'driver.js';

export const INVENTARIO_TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-inventario-header',
    popover: {
      title: 'Modulo Inventario',
      description: 'Gestiona productos, proveedores, ordenes de compra, stock y configuracion del inventario.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-inventario-subnav',
    popover: {
      title: 'Navegacion del modulo',
      description: 'Productos, Recetas, Proveedores, Ordenes de compra, Costos y Almacenes: cada pestana te lleva a su seccion.',
      side: 'bottom',
      align: 'start'
    }
  },
  {
    element: '#tour-inventario-content',
    popover: {
      title: 'Tu contenido aqui',
      description: 'Aqui se muestra la seccion que elijas dentro del inventario.',
      side: 'top',
      align: 'center'
    }
  }
];

import type { DriveStep } from 'driver.js';

/**
 * Lazily-loaded per-module tour step definitions, keyed by module id.
 * Add an entry here as tours are authored for additional modules.
 */
export const TOUR_STEPS_REGISTRY: Record<string, () => Promise<DriveStep[]>> = {
  dashboard: () => import('./dashboard.tour').then((mod) => mod.DASHBOARD_TOUR_STEPS),
  clientes: () => import('./clientes.tour').then((mod) => mod.CLIENTES_TOUR_STEPS),
  facturacion: () => import('./facturacion.tour').then((mod) => mod.FACTURACION_TOUR_STEPS),
  ventas: () => import('./ventas.tour').then((mod) => mod.VENTAS_TOUR_STEPS),
  servicios: () => import('./servicios.tour').then((mod) => mod.SERVICIOS_TOUR_STEPS),
  asistente_ventas: () => import('./asistente-ventas.tour').then((mod) => mod.ASISTENTE_VENTAS_TOUR_STEPS),
  inventario: () => import('./inventario.tour').then((mod) => mod.INVENTARIO_TOUR_STEPS),
  contabilidad: () => import('./contabilidad.tour').then((mod) => mod.CONTABILIDAD_TOUR_STEPS),
  colaboradores: () => import('./colaboradores.tour').then((mod) => mod.COLABORADORES_TOUR_STEPS),
  archivos: () => import('./archivos.tour').then((mod) => mod.ARCHIVOS_TOUR_STEPS)
};

export async function loadTourSteps(moduleId: string): Promise<DriveStep[]> {
  const loader = TOUR_STEPS_REGISTRY[moduleId];
  return loader ? loader() : [];
}

import { TablePreferenceIdentity } from '../models/table-preferences.models';

export const OPERATIONAL_TABLES: readonly TablePreferenceIdentity[] = [
  { moduleId: 'archivos', tableId: 'lista' },
  { moduleId: 'auditoria', tableId: 'eventos' },
  { moduleId: 'clientes', tableId: 'lista' },
  { moduleId: 'empresa', tableId: 'colaboradores' },
  { moduleId: 'ventas', tableId: 'resumen' },
  { moduleId: 'servicios', tableId: 'lista' },
  { moduleId: 'facturacion', tableId: 'firmas' },
  { moduleId: 'facturacion', tableId: 'sri-descargas' },
  { moduleId: 'inventario', tableId: 'productos' },
  { moduleId: 'inventario', tableId: 'proveedores' },
  { moduleId: 'inventario', tableId: 'recetas' },
  { moduleId: 'inventario', tableId: 'ordenes-compra' },
  { moduleId: 'inventario', tableId: 'costos' },
  { moduleId: 'inventario', tableId: 'existencias-almacen' },
  { moduleId: 'contabilidad', tableId: 'plan-cuentas' },
  { moduleId: 'contabilidad', tableId: 'asientos' },
  { moduleId: 'contabilidad', tableId: 'facturas-compra' },
  { moduleId: 'contabilidad', tableId: 'cuentas-por-pagar' },
  { moduleId: 'contabilidad', tableId: 'cuentas-por-pagar-cartera' },
  { moduleId: 'contabilidad', tableId: 'cuentas-por-pagar-historial' },
  { moduleId: 'contabilidad', tableId: 'pagos-proveedor' },
  { moduleId: 'bancos', tableId: 'cuentas' },
  { moduleId: 'bancos', tableId: 'movimientos' },
  { moduleId: 'bancos', tableId: 'reglas' },
  { moduleId: 'bancos', tableId: 'tesoreria' },
  { moduleId: 'nomina', tableId: 'roles-pago' },
  { moduleId: 'nomina', tableId: 'empleados' },
  { moduleId: 'nomina', tableId: 'rubros' },
  { moduleId: 'nomina', tableId: 'anticipos' }
];

export function isOperationalTableRegistered(moduleId: string, tableId: string): boolean {
  if (moduleId === 'sitio-web' && tableId.startsWith('respuestas-')) return true;
  return OPERATIONAL_TABLES.some((table) => table.moduleId === moduleId && table.tableId === tableId);
}

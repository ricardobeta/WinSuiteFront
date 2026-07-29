import {
  DashboardLayoutConfig,
  DashboardLayoutItem,
  DashboardWidgetDefinition,
  DashboardWidgetId
} from '../models/dashboard.models';

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: 'sales-today',
    title: 'Ventas de hoy',
    subtitle: 'Total vendido en el día',
    icon: 'payments',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'summary',
    mobileOrder: 1
  },
  {
    id: 'average-ticket',
    title: 'Ticket promedio',
    subtitle: 'Promedio de ventas completadas',
    icon: 'receipt_long',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'summary',
    mobileOrder: 2
  },
  {
    id: 'transactions-today',
    title: 'Transacciones',
    subtitle: 'Ventas completadas de hoy',
    icon: 'point_of_sale',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'summary',
    mobileOrder: 3
  },
  {
    id: 'active-customers',
    title: 'Clientes activos',
    subtitle: 'Base comercial registrada',
    icon: 'groups',
    kind: 'metric',
    moduleKey: 'clientes',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'summary',
    mobileOrder: 4
  },
  {
    id: 'active-services',
    title: 'Servicios activos',
    subtitle: 'Catálogo disponible para vender',
    icon: 'build_circle',
    kind: 'metric',
    moduleKey: 'servicios',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'analysis',
    mobileOrder: 6
  },
  {
    id: 'sri-authorized-invoices',
    title: 'Facturas SRI',
    subtitle: 'Autorizadas correctamente',
    icon: 'verified',
    kind: 'metric',
    moduleKey: 'facturacion',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'analysis',
    mobileOrder: 5
  },
  {
    id: 'sales-last-7-days',
    title: 'Ventas últimos 7 días',
    subtitle: 'Tendencia diaria de ingresos',
    icon: 'show_chart',
    kind: 'chart',
    chartKind: 'area',
    moduleKey: 'ventas',
    defaultCols: 6,
    defaultRows: 4,
    minRows: 3,
    mobileSection: 'analysis',
    mobileOrder: 1
  },
  {
    id: 'payment-methods',
    title: 'Métodos de pago',
    subtitle: 'Distribución de caja del periodo',
    icon: 'bar_chart',
    kind: 'chart',
    chartKind: 'pie',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 4,
    minRows: 3,
    mobileSection: 'analysis',
    mobileOrder: 2
  },
  {
    id: 'low-stock-products',
    title: 'Productos bajo stock',
    subtitle: 'Alertas de inventario',
    icon: 'inventory',
    kind: 'table',
    moduleKey: 'inventario',
    defaultCols: 3,
    defaultRows: 4,
    minRows: 3,
    mobileSection: 'alert',
    mobileOrder: 1,
    actionLabel: 'Ver inventario',
    actionRoute: '/workspace/inventario/productos'
  },
  {
    id: 'accounting-month-result',
    title: 'Resultado del mes',
    subtitle: 'Ingresos, costos y gastos',
    icon: 'account_balance',
    kind: 'chart',
    chartKind: 'comparison',
    moduleKey: 'contabilidad',
    defaultCols: 6,
    defaultRows: 4,
    minRows: 3,
    mobileSection: 'analysis',
    mobileOrder: 3
  },
  {
    id: 'inventory-value',
    title: 'Valor inventario',
    subtitle: 'Valor estimado a costo',
    icon: 'warehouse',
    kind: 'metric',
    moduleKey: 'inventario',
    defaultCols: 3,
    defaultRows: 2,
    minRows: 2,
    mobileSection: 'analysis',
    mobileOrder: 4
  }
];

export const DEFAULT_DASHBOARD_ITEMS: DashboardLayoutItem[] = [
  { instanceId: 'sales-today', widgetId: 'sales-today', x: 0, y: 0, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 },
  { instanceId: 'average-ticket', widgetId: 'average-ticket', x: 3, y: 0, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 },
  { instanceId: 'transactions-today', widgetId: 'transactions-today', x: 6, y: 0, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 },
  { instanceId: 'active-customers', widgetId: 'active-customers', x: 9, y: 0, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 },
  { instanceId: 'sales-last-7-days', widgetId: 'sales-last-7-days', x: 0, y: 2, cols: 6, rows: 4, minItemRows: 3 },
  { instanceId: 'payment-methods', widgetId: 'payment-methods', x: 6, y: 2, cols: 3, rows: 4, minItemRows: 3 },
  { instanceId: 'low-stock-products', widgetId: 'low-stock-products', x: 9, y: 2, cols: 3, rows: 4, minItemRows: 3 },
  { instanceId: 'accounting-month-result', widgetId: 'accounting-month-result', x: 0, y: 6, cols: 6, rows: 4, minItemRows: 3 },
  { instanceId: 'inventory-value', widgetId: 'inventory-value', x: 6, y: 6, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 },
  { instanceId: 'sri-authorized-invoices', widgetId: 'sri-authorized-invoices', x: 9, y: 6, cols: 3, rows: 2, minItemRows: 2, maxItemCols: 3, maxItemRows: 2 }
];

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutConfig = {
  version: 1,
  updatedAt: 0,
  updatedBy: null,
  items: DEFAULT_DASHBOARD_ITEMS
};

export function cloneDefaultDashboardLayout(): DashboardLayoutConfig {
  return {
    ...DEFAULT_DASHBOARD_LAYOUT,
    items: DEFAULT_DASHBOARD_ITEMS.map((item) => ({ ...item }))
  };
}

export function findWidgetDefinition(widgetId: DashboardWidgetId): DashboardWidgetDefinition | undefined {
  return DASHBOARD_WIDGETS.find((widget) => widget.id === widgetId);
}

export function normalizeDashboardLayoutItem(item: DashboardLayoutItem): DashboardLayoutItem {
  const definition = findWidgetDefinition(item.widgetId);
  const minRows = definition?.minRows ?? 1;
  const maxRows = definition?.kind === 'metric' ? definition.defaultRows : Number.POSITIVE_INFINITY;
  const maxCols = definition?.kind === 'metric' ? definition.defaultCols : 12;
  const cols = Math.min(maxCols, Math.max(1, Number(item.cols ?? definition?.defaultCols ?? 3)));
  const rows = Math.min(maxRows, Math.max(minRows, Number(item.rows ?? definition?.defaultRows ?? minRows)));

  return {
    ...item,
    x: Math.min(12 - cols, Math.max(0, Number(item.x ?? 0))),
    cols,
    rows,
    minItemRows: minRows,
    maxItemCols: definition?.kind === 'metric' ? maxCols : undefined,
    maxItemRows: definition?.kind === 'metric' ? maxRows : undefined
  };
}

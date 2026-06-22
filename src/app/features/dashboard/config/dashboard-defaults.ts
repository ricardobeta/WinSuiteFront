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
    subtitle: 'Total vendido en el dia',
    icon: 'payments',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'average-ticket',
    title: 'Ticket promedio',
    subtitle: 'Promedio de ventas completadas',
    icon: 'receipt_long',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'transactions-today',
    title: 'Transacciones',
    subtitle: 'Ventas completadas de hoy',
    icon: 'point_of_sale',
    kind: 'metric',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'active-customers',
    title: 'Clientes activos',
    subtitle: 'Base comercial registrada',
    icon: 'groups',
    kind: 'metric',
    moduleKey: 'clientes',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'active-services',
    title: 'Servicios activos',
    subtitle: 'Catalogo disponible para vender',
    icon: 'build_circle',
    kind: 'metric',
    moduleKey: 'servicios',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'sri-authorized-invoices',
    title: 'Facturas SRI',
    subtitle: 'Autorizadas correctamente',
    icon: 'verified',
    kind: 'metric',
    moduleKey: 'facturacion',
    defaultCols: 3,
    defaultRows: 2
  },
  {
    id: 'sales-last-7-days',
    title: 'Ventas ultimos 7 dias',
    subtitle: 'Tendencia diaria de ingresos',
    icon: 'show_chart',
    kind: 'chart',
    chartKind: 'area',
    moduleKey: 'ventas',
    defaultCols: 6,
    defaultRows: 4
  },
  {
    id: 'payment-methods',
    title: 'Metodos de pago',
    subtitle: 'Distribucion de caja del periodo',
    icon: 'donut_large',
    kind: 'chart',
    chartKind: 'pie',
    moduleKey: 'ventas',
    defaultCols: 3,
    defaultRows: 4
  },
  {
    id: 'low-stock-products',
    title: 'Productos bajo stock',
    subtitle: 'Alertas de inventario',
    icon: 'inventory',
    kind: 'table',
    moduleKey: 'inventario',
    defaultCols: 3,
    defaultRows: 4
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
    defaultRows: 4
  },
  {
    id: 'inventory-value',
    title: 'Valor inventario',
    subtitle: 'Valor estimado a costo',
    icon: 'warehouse',
    kind: 'metric',
    moduleKey: 'inventario',
    defaultCols: 3,
    defaultRows: 2
  }
];

export const DEFAULT_DASHBOARD_ITEMS: DashboardLayoutItem[] = [
  { instanceId: 'sales-today', widgetId: 'sales-today', x: 0, y: 0, cols: 3, rows: 2 },
  { instanceId: 'average-ticket', widgetId: 'average-ticket', x: 3, y: 0, cols: 3, rows: 2 },
  { instanceId: 'transactions-today', widgetId: 'transactions-today', x: 6, y: 0, cols: 3, rows: 2 },
  { instanceId: 'active-customers', widgetId: 'active-customers', x: 9, y: 0, cols: 3, rows: 2 },
  { instanceId: 'sales-last-7-days', widgetId: 'sales-last-7-days', x: 0, y: 2, cols: 6, rows: 4 },
  { instanceId: 'payment-methods', widgetId: 'payment-methods', x: 6, y: 2, cols: 3, rows: 4 },
  { instanceId: 'low-stock-products', widgetId: 'low-stock-products', x: 9, y: 2, cols: 3, rows: 4 },
  { instanceId: 'accounting-month-result', widgetId: 'accounting-month-result', x: 0, y: 6, cols: 6, rows: 4 },
  { instanceId: 'inventory-value', widgetId: 'inventory-value', x: 6, y: 6, cols: 3, rows: 2 },
  { instanceId: 'sri-authorized-invoices', widgetId: 'sri-authorized-invoices', x: 9, y: 6, cols: 3, rows: 2 }
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

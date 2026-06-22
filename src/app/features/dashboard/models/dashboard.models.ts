import { GridsterItemConfig } from 'angular-gridster2';
import { EChartsCoreOption } from 'echarts/core';

export type DashboardWidgetKind = 'metric' | 'chart' | 'table';
export type DashboardChartKind = 'line' | 'bar' | 'pie' | 'area' | 'comparison';

export type DashboardWidgetId =
  | 'sales-today'
  | 'average-ticket'
  | 'transactions-today'
  | 'active-customers'
  | 'active-services'
  | 'sri-authorized-invoices'
  | 'sales-last-7-days'
  | 'payment-methods'
  | 'low-stock-products'
  | 'inventory-value'
  | 'accounting-month-result';

export interface DashboardLayoutItem extends GridsterItemConfig {
  instanceId: string;
  widgetId: DashboardWidgetId;
}

export interface DashboardLayoutConfig {
  version: 1;
  updatedAt: number;
  updatedBy?: string | null;
  items: DashboardLayoutItem[];
}

export interface DashboardWidgetDefinition {
  id: DashboardWidgetId;
  title: string;
  subtitle: string;
  icon: string;
  kind: DashboardWidgetKind;
  moduleKey?: string;
  chartKind?: DashboardChartKind;
  defaultCols: number;
  defaultRows: number;
}

export interface DashboardMetricValue {
  value: string;
  label?: string;
  helper?: string;
  trend?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface DashboardTableRow {
  label: string;
  value: string;
  helper?: string;
  tone?: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface DashboardWidgetData {
  metric?: DashboardMetricValue;
  chartOptions?: EChartsCoreOption;
  rows?: DashboardTableRow[];
  emptyMessage?: string;
}

export interface DashboardDataMap {
  [widgetId: string]: DashboardWidgetData;
}

export type TableColumnGroup = 'standard' | 'custom';

export interface TableColumnDefinition {
  id: string;
  label: string;
  group?: TableColumnGroup;
  defaultVisible?: boolean;
  locked?: boolean;
  /** Clase de Angular Material cuando difiere de `mat-column-${id}`. */
  domId?: string;
}

export interface TableViewConfig {
  version: 1;
  visibleColumnIds: string[];
  updatedAt: number;
  updatedBy: string;
}

export type TableViewSource = 'personal' | 'company' | 'default';

export interface ResolvedTableView {
  visibleColumnIds: string[];
  source: TableViewSource;
  updatedAt: number | null;
  updatedBy: string | null;
}

export interface TablePreferenceIdentity {
  moduleId: string;
  tableId: string;
}

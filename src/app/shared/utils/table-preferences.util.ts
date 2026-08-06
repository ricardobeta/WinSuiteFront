import { ResolvedTableView, TableColumnDefinition } from '../models/table-preferences.models';

export function normalizeVisibleColumnIds(
  requestedIds: readonly string[],
  columns: readonly TableColumnDefinition[]
): string[] {
  const requested = new Set(requestedIds);
  const normalized = columns
    .filter((column) => column.locked || requested.has(column.id))
    .map((column) => column.id);

  if (normalized.some((id) => !columns.find((column) => column.id === id)?.locked)) {
    return normalized;
  }

  const firstSelectable = columns.find((column) => !column.locked);
  return columns
    .filter((column) => column.locked || column.id === firstSelectable?.id)
    .map((column) => column.id);
}

export function createDefaultTableView(
  columns: readonly TableColumnDefinition[]
): ResolvedTableView {
  return {
    visibleColumnIds: columns
      .filter((column) => column.locked || column.defaultVisible !== false)
      .map((column) => column.id),
    source: 'default',
    updatedAt: null,
    updatedBy: null
  };
}

export function reconcileTableView(
  view: ResolvedTableView,
  columns: readonly TableColumnDefinition[]
): ResolvedTableView {
  return {
    ...view,
    visibleColumnIds: normalizeVisibleColumnIds(view.visibleColumnIds, columns)
  };
}

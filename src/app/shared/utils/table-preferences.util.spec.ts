import { describe, expect, it } from 'vitest';

import { ResolvedTableView, TableColumnDefinition } from '../models/table-preferences.models';
import {
  createDefaultTableView,
  normalizeVisibleColumnIds,
  reconcileTableView
} from './table-preferences.util';

const columns: readonly TableColumnDefinition[] = [
  { id: 'nombre', label: 'Nombre' },
  { id: 'email', label: 'Email', defaultVisible: false },
  { id: 'custom_sector', label: 'Sector', group: 'custom', defaultVisible: true },
  { id: 'acciones', label: 'Acciones', locked: true }
];

describe('table preferences', () => {
  it('crea la vista inicial respetando defaultVisible y las columnas bloqueadas', () => {
    expect(createDefaultTableView(columns).visibleColumnIds).toEqual([
      'nombre',
      'custom_sector',
      'acciones'
    ]);
  });

  it('conserva el orden canonico e ignora identificadores eliminados', () => {
    expect(normalizeVisibleColumnIds(['desconocida', 'email', 'nombre'], columns)).toEqual([
      'nombre',
      'email',
      'acciones'
    ]);
  });

  it('mantiene al menos una columna de datos y todas las bloqueadas', () => {
    expect(normalizeVisibleColumnIds([], columns)).toEqual(['nombre', 'acciones']);
  });

  it('preserva el origen al reconciliar cambios del catalogo', () => {
    const view: ResolvedTableView = {
      visibleColumnIds: ['email'],
      source: 'personal',
      updatedAt: 10,
      updatedBy: 'user-1'
    };
    expect(reconcileTableView(view, columns)).toEqual({
      visibleColumnIds: ['email', 'acciones'],
      source: 'personal',
      updatedAt: 10,
      updatedBy: 'user-1'
    });
  });
});

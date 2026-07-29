import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_ITEMS,
  normalizeDashboardLayoutItem
} from './dashboard-defaults';

describe('dashboard defaults', () => {
  it('defines responsive metadata and minimum heights for every widget', () => {
    expect(DASHBOARD_WIDGETS.length).toBeGreaterThan(0);

    for (const widget of DASHBOARD_WIDGETS) {
      expect(['summary', 'alert', 'analysis']).toContain(widget.mobileSection);
      expect(widget.mobileOrder).toBeGreaterThan(0);
      expect(widget.defaultRows).toBeGreaterThanOrEqual(widget.minRows);
    }
  });

  it('keeps compact legacy metrics resizeable without changing identity', () => {
    const legacyItem = {
      instanceId: 'legacy-sales',
      widgetId: 'sales-today' as const,
      x: 0,
      y: 0,
      cols: 3,
      rows: 2
    };

    expect(normalizeDashboardLayoutItem(legacyItem)).toEqual({
      ...legacyItem,
      rows: 2,
      minItemRows: 2,
      maxItemCols: 3,
      maxItemRows: 2
    });
  });

  it('normalizes oversized metric cards back to the KPI column width', () => {
    const normalized = normalizeDashboardLayoutItem({
      instanceId: 'wide-transactions',
      widgetId: 'transactions-today',
      x: 6,
      y: 0,
      cols: 6,
      rows: 3
    });

    expect(normalized.cols).toBe(3);
    expect(normalized.maxItemCols).toBe(3);
    expect(normalized.rows).toBe(2);
    expect(normalized.maxItemRows).toBe(2);
  });

  it('keeps all default items at or above their widget minimum', () => {
    for (const item of DEFAULT_DASHBOARD_ITEMS) {
      const normalized = normalizeDashboardLayoutItem(item);
      expect(normalized.rows).toBe(item.rows);
      expect(normalized.minItemRows).toBeLessThanOrEqual(normalized.rows);
    }
  });
});

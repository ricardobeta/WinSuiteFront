import { SpanishPaginatorIntl } from './spanish-paginator-intl';

describe('SpanishPaginatorIntl', () => {
  const paginator = new SpanishPaginatorIntl();

  it('uses Spanish labels', () => {
    expect(paginator.itemsPerPageLabel).toBe('Elementos por página');
    expect(paginator.nextPageLabel).toBe('Página siguiente');
  });

  it('formats normal and empty ranges', () => {
    expect(paginator.getRangeLabel(1, 10, 35)).toBe('11–20 de 35');
    expect(paginator.getRangeLabel(0, 10, 0)).toBe('0 de 0');
  });
});

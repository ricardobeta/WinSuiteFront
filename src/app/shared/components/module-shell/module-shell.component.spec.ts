import { calculateVisibleNavIndices } from './module-shell.component';

describe('calculateVisibleNavIndices', () => {
  it('keeps all entries when they fit', () => {
    expect(calculateVisibleNavIndices([80, 90, 70], 260, 80)).toEqual([0, 1, 2]);
  });

  it('reserves space for the overflow button', () => {
    expect(calculateVisibleNavIndices([100, 100, 100], 250, 70)).toEqual([0]);
  });

  it('keeps the active entry visible when it would overflow', () => {
    expect(calculateVisibleNavIndices([100, 100, 100, 100], 300, 70, 3)).toEqual([0, 3]);
  });

  it('shows only the active entry on extremely narrow widths', () => {
    expect(calculateVisibleNavIndices([120, 120], 80, 70, 1)).toEqual([1]);
  });
});

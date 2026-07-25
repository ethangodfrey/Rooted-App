import { describe, expect, it } from 'vitest';

import {
  allocateHybridStock,
  formatHybridStockLabel,
  formatHybridStockPercentLabel,
  percentFromQuantities,
} from './hybrid-stock';

describe('allocateHybridStock', () => {
  it('splits a batch into integer pre-order and walk-up units', () => {
    expect(allocateHybridStock(100, 70)).toEqual({
      preOrder: 70,
      walkUp: 30,
      preOrderPercent: 70,
    });
  });

  it('assigns walk-up the rounding remainder so totals always match', () => {
    expect(allocateHybridStock(10, 33)).toEqual({
      preOrder: 3,
      walkUp: 7,
      preOrderPercent: 33,
    });
  });

  it('returns zeroed units for zero or invalid stock', () => {
    expect(allocateHybridStock(0, 50)).toEqual({
      preOrder: 0,
      walkUp: 0,
      preOrderPercent: 50,
    });
    expect(allocateHybridStock(-5, 50)).toEqual({
      preOrder: 0,
      walkUp: 0,
      preOrderPercent: 50,
    });
    expect(allocateHybridStock(Number.NaN, 50)).toEqual({
      preOrder: 0,
      walkUp: 0,
      preOrderPercent: 50,
    });
  });

  it('clamps invalid percentages into the 0–100 range', () => {
    expect(allocateHybridStock(20, -10)).toEqual({
      preOrder: 0,
      walkUp: 20,
      preOrderPercent: 0,
    });
    expect(allocateHybridStock(20, 150)).toEqual({
      preOrder: 20,
      walkUp: 0,
      preOrderPercent: 100,
    });
    expect(allocateHybridStock(20, Number.POSITIVE_INFINITY)).toEqual({
      preOrder: 0,
      walkUp: 20,
      preOrderPercent: 0,
    });
  });
});

describe('percentFromQuantities', () => {
  it('derives the pre-order share from stored quantities', () => {
    expect(percentFromQuantities(7, 3)).toBe(70);
    expect(percentFromQuantities(1, 1)).toBe(50);
  });

  it('defaults to 50% when both quantities are zero', () => {
    expect(percentFromQuantities(0, 0)).toBe(50);
  });

  it('treats invalid inputs as zero', () => {
    expect(percentFromQuantities(Number.NaN, 5)).toBe(0);
    expect(percentFromQuantities(5, Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('formatHybridStockLabel', () => {
  it('formats the unit split for display', () => {
    expect(
      formatHybridStockLabel({ preOrder: 12, walkUp: 5, preOrderPercent: 71 }),
    ).toBe('12 Pre-Order / 5 Walk-Up');
  });
});

describe('formatHybridStockPercentLabel', () => {
  it('formats the percent split for display', () => {
    expect(
      formatHybridStockPercentLabel({ preOrder: 12, walkUp: 5, preOrderPercent: 71 }),
    ).toBe('71% Pre-Order / 29% Walk-Up');
  });
});

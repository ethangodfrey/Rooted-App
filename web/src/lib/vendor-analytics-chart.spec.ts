import { describe, expect, it } from 'vitest';

import { centsToChartValue, maxChartValue } from './vendor-analytics';

describe('centsToChartValue', () => {
  it('converts integer cents to dollar chart values', () => {
    expect(centsToChartValue(0)).toBe(0);
    expect(centsToChartValue(100)).toBe(1);
    expect(centsToChartValue(1234)).toBe(12.34);
  });

  it('rounds to two decimal places for chart display', () => {
    expect(centsToChartValue(1)).toBe(0.01);
    expect(centsToChartValue(999)).toBe(9.99);
    expect(centsToChartValue(1005)).toBe(10.05);
  });
});

describe('maxChartValue', () => {
  it('returns the largest positive value in the series', () => {
    expect(maxChartValue([1, 5, 3])).toBe(5);
    expect(maxChartValue([0, 0, 2.5])).toBe(2.5);
  });

  it('falls back to the floor when all values are zero or negative', () => {
    expect(maxChartValue([0, -1, -2])).toBe(1);
    expect(maxChartValue([], 10)).toBe(10);
  });

  it('supports custom floor values', () => {
    expect(maxChartValue([-5, -10], 25)).toBe(25);
  });
});

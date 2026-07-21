import { describe, expect, it } from 'vitest';

import { formatUsdFromCents } from './vendor-financials';

describe('formatUsdFromCents', () => {
  it('formats whole-dollar amounts', () => {
    expect(formatUsdFromCents(1000)).toBe('$10.00');
    expect(formatUsdFromCents(0)).toBe('$0.00');
  });

  it('formats fractional cents', () => {
    expect(formatUsdFromCents(1250)).toBe('$12.50');
    expect(formatUsdFromCents(99)).toBe('$0.99');
  });

  it('clamps negative values to zero dollars', () => {
    expect(formatUsdFromCents(-500)).toBe('$0.00');
    expect(formatUsdFromCents(-1)).toBe('$0.00');
  });

  it('handles large totals', () => {
    expect(formatUsdFromCents(1_234_567)).toBe('$12345.67');
  });

  it('rounds fractional cent inputs via standard currency formatting', () => {
    expect(formatUsdFromCents(1000.4)).toBe('$10.00');
    expect(formatUsdFromCents(1000.5)).toBe('$10.01');
  });

  it('formats non-finite values as zero dollars', () => {
    expect(formatUsdFromCents(Number.NaN)).toBe('$NaN');
    expect(formatUsdFromCents(Number.POSITIVE_INFINITY)).toBe('$Infinity');
  });
});

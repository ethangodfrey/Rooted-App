import { describe, expect, it } from 'vitest';

import {
  PLATFORM_FEE_BPS,
  calculateVendorSettlement,
  computePlatformFeeCents,
} from './settlement-calculator';

describe('computePlatformFeeCents', () => {
  it('applies 5% with half-up rounding', () => {
    expect(computePlatformFeeCents(10_000, PLATFORM_FEE_BPS)).toBe(500);
    expect(computePlatformFeeCents(10_01, PLATFORM_FEE_BPS)).toBe(50);
    expect(computePlatformFeeCents(999, PLATFORM_FEE_BPS)).toBe(50);
  });

  it('returns zero for non-positive amounts or fee rates', () => {
    expect(computePlatformFeeCents(0)).toBe(0);
    expect(computePlatformFeeCents(-100)).toBe(0);
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
    expect(computePlatformFeeCents(Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(1000, Number.NaN)).toBe(0);
  });
});

describe('calculateVendorSettlement', () => {
  it('aggregates gross, platform fee, and net vendor allocations', () => {
    const result = calculateVendorSettlement([
      { id: 'a', totalCents: 2000, platformFeeCents: 100 },
      { id: 'b', totalCents: 3000, platformFeeCents: 150 },
    ]);

    expect(result.orderCount).toBe(2);
    expect(result.grossVolumeCents).toBe(5000);
    expect(result.platformFeeCents).toBe(250);
    expect(result.netVendorCents).toBe(4750);
    expect(result.lines).toHaveLength(2);
  });

  it('derives platform fee when not persisted on the order', () => {
    const result = calculateVendorSettlement([{ id: 'x', totalCents: 10_000 }]);
    expect(result.platformFeeCents).toBe(500);
    expect(result.netVendorCents).toBe(9500);
  });

  it('clamps negative totals and fees to zero', () => {
    const result = calculateVendorSettlement([
      { id: 'bad', totalCents: -500, platformFeeCents: -50 },
    ]);

    expect(result.grossVolumeCents).toBe(0);
    expect(result.platformFeeCents).toBe(0);
    expect(result.netVendorCents).toBe(0);
  });

  it('returns empty aggregates for an empty order list', () => {
    const result = calculateVendorSettlement([]);
    expect(result).toEqual({
      orderCount: 0,
      grossVolumeCents: 0,
      platformFeeCents: 0,
      netVendorCents: 0,
      lines: [],
    });
  });
});

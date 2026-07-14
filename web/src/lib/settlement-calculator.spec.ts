import { describe, expect, it } from 'vitest';

import {
  calculateVendorSettlement,
  computePlatformFeeCents,
  PLATFORM_FEE_BPS,
} from './settlement-calculator';

describe('computePlatformFeeCents', () => {
  it('applies 5% with half-up rounding', () => {
    expect(computePlatformFeeCents(10_000)).toBe(500);
    expect(computePlatformFeeCents(10_01)).toBe(50);
    expect(computePlatformFeeCents(999)).toBe(50);
  });

  it('returns zero for non-positive or invalid amounts', () => {
    expect(computePlatformFeeCents(0)).toBe(0);
    expect(computePlatformFeeCents(-100)).toBe(0);
    expect(computePlatformFeeCents(Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns zero when fee basis points are non-positive', () => {
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
    expect(computePlatformFeeCents(1000, -100)).toBe(0);
  });

  it('uses the default platform fee rate', () => {
    expect(PLATFORM_FEE_BPS).toBe(500);
    expect(computePlatformFeeCents(2000)).toBe(100);
  });
});

describe('calculateVendorSettlement', () => {
  it('aggregates gross, platform fee, and net vendor allocations', () => {
    const result = calculateVendorSettlement([
      { id: 'a', totalCents: 2000, platformFeeCents: 100 },
      { id: 'b', totalCents: 3000, platformFeeCents: 150 },
    ]);

    expect(result).toMatchObject({
      orderCount: 2,
      grossVolumeCents: 5000,
      platformFeeCents: 250,
      netVendorCents: 4750,
    });
    expect(result.lines).toHaveLength(2);
  });

  it('derives platform fee when not persisted on the order', () => {
    const result = calculateVendorSettlement([{ id: 'x', totalCents: 10_000 }]);
    expect(result.platformFeeCents).toBe(500);
    expect(result.netVendorCents).toBe(9500);
  });

  it('handles empty order lists', () => {
    const result = calculateVendorSettlement([]);
    expect(result).toMatchObject({
      orderCount: 0,
      grossVolumeCents: 0,
      platformFeeCents: 0,
      netVendorCents: 0,
      lines: [],
    });
  });

  it('clamps negative totals to zero', () => {
    const result = calculateVendorSettlement([{ id: 'bad', totalCents: -500 }]);
    expect(result.lines[0]).toMatchObject({
      grossCents: 0,
      platformFeeCents: 0,
      netVendorCents: 0,
    });
  });
});

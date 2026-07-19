import { describe, expect, it } from 'vitest';

import {
  PLATFORM_FEE_BPS,
  calculateVendorSettlement,
  computePlatformFeeCents,
} from './settlement-calculator';

describe('computePlatformFeeCents', () => {
  it('computes a 5% platform fee with half-up rounding', () => {
    expect(computePlatformFeeCents(1000)).toBe(50);
    expect(computePlatformFeeCents(2000, PLATFORM_FEE_BPS)).toBe(100);
    expect(computePlatformFeeCents(999, 500)).toBe(50);
    expect(computePlatformFeeCents(1, 500)).toBe(0);
  });

  it('returns zero for non-positive subtotals', () => {
    expect(computePlatformFeeCents(0)).toBe(0);
    expect(computePlatformFeeCents(-500)).toBe(0);
  });

  it('returns zero for invalid numeric inputs', () => {
    expect(computePlatformFeeCents(Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(Number.POSITIVE_INFINITY)).toBe(0);
    expect(computePlatformFeeCents(1000, Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(1000, -100)).toBe(0);
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
  });

  it('supports custom basis-point rates', () => {
    expect(computePlatformFeeCents(10_000, 250)).toBe(250);
    expect(computePlatformFeeCents(10_000, 1000)).toBe(1000);
  });
});

describe('calculateVendorSettlement', () => {
  it('aggregates gross, platform fee, and net vendor totals', () => {
    const result = calculateVendorSettlement([
      { id: 'order-1', totalCents: 2000 },
      { id: 'order-2', totalCents: 1000 },
    ]);

    expect(result).toEqual({
      orderCount: 2,
      grossVolumeCents: 3000,
      platformFeeCents: 150,
      netVendorCents: 2850,
      lines: [
        { orderId: 'order-1', grossCents: 2000, platformFeeCents: 100, netVendorCents: 1900 },
        { orderId: 'order-2', grossCents: 1000, platformFeeCents: 50, netVendorCents: 950 },
      ],
    });
  });

  it('honors persisted platform fees when provided', () => {
    const result = calculateVendorSettlement([
      { id: 'order-1', totalCents: 2000, platformFeeCents: 75 },
      { id: 'order-2', totalCents: 1000, platformFeeCents: 0 },
    ]);

    expect(result.platformFeeCents).toBe(75);
    expect(result.lines[0].netVendorCents).toBe(1925);
    expect(result.lines[1].netVendorCents).toBe(1000);
  });

  it('clamps negative totals and fees to zero', () => {
    const result = calculateVendorSettlement([
      { id: 'order-neg', totalCents: -500, platformFeeCents: -25 },
    ]);

    expect(result).toMatchObject({
      orderCount: 1,
      grossVolumeCents: 0,
      platformFeeCents: 0,
      netVendorCents: 0,
    });
  });

  it('rounds fractional cent inputs before computing fees', () => {
    const result = calculateVendorSettlement([{ id: 'order-frac', totalCents: 1000.6 }]);

    expect(result.lines[0]).toMatchObject({
      grossCents: 1001,
      platformFeeCents: 50,
      netVendorCents: 951,
    });
  });

  it('returns zeroed aggregates for an empty order list', () => {
    expect(calculateVendorSettlement([])).toEqual({
      orderCount: 0,
      grossVolumeCents: 0,
      platformFeeCents: 0,
      netVendorCents: 0,
      lines: [],
    });
  });

  it('derives fees when platformFeeCents is undefined or non-finite', () => {
    const result = calculateVendorSettlement([
      { id: 'order-a', totalCents: 1000, platformFeeCents: undefined },
      { id: 'order-b', totalCents: 1000, platformFeeCents: Number.NaN },
    ]);

    expect(result.platformFeeCents).toBe(100);
    expect(result.netVendorCents).toBe(1900);
  });
});

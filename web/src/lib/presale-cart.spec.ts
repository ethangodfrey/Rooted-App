import { describe, expect, it } from 'vitest';

import {
  PLATFORM_FEE_BPS,
  cartItemCount,
  computeCartTotals,
  estimateTaxBps,
  groupCartByVendor,
  type PresaleCart,
  type PresaleCartLine,
} from './presale-cart';

function sampleLine(overrides: Partial<PresaleCartLine> = {}): PresaleCartLine {
  return {
    productId: 'prod-1',
    vendorId: 'vendor-a',
    vendorName: 'Farm A',
    name: 'Tomatoes',
    price: 500,
    quantity: 2,
    maxQuantity: 10,
    ...overrides,
  };
}

function sampleCart(overrides: Partial<PresaleCart> = {}): PresaleCart {
  return {
    marketId: 'market-1',
    marketName: 'Saturday Market',
    marketCity: 'Chicago',
    marketState: 'IL',
    marketAddress: '123 Main St',
    pickupSchedule: {
      start_datetime: '2026-07-12T13:00:00.000Z',
      end_datetime: '2026-07-12T18:00:00.000Z',
      timezone: 'America/Chicago',
      state: 'IL',
    },
    lines: [sampleLine()],
    updatedAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('estimateTaxBps', () => {
  it('returns configured basis points for known states', () => {
    expect(estimateTaxBps('CA')).toBe(725);
    expect(estimateTaxBps('il')).toBe(625);
    expect(estimateTaxBps('OR')).toBe(0);
  });

  it('returns zero for empty, unknown, or undefined state codes', () => {
    expect(estimateTaxBps('')).toBe(0);
    expect(estimateTaxBps(null)).toBe(0);
    expect(estimateTaxBps(undefined)).toBe(0);
    expect(estimateTaxBps('ZZ')).toBe(0);
    expect(estimateTaxBps('  ')).toBe(0);
  });
});

describe('cartItemCount', () => {
  it('sums line quantities', () => {
    const cart = sampleCart({
      lines: [
        sampleLine({ quantity: 2 }),
        sampleLine({ productId: 'prod-2', quantity: 3 }),
      ],
    });
    expect(cartItemCount(cart)).toBe(5);
  });

  it('returns zero for null or empty carts', () => {
    expect(cartItemCount(null)).toBe(0);
    expect(cartItemCount(sampleCart({ lines: [] }))).toBe(0);
  });
});

describe('groupCartByVendor', () => {
  it('groups lines by vendor and computes per-vendor cents totals', () => {
    const cart = sampleCart({
      marketState: 'IL',
      lines: [
        sampleLine({ vendorId: 'vendor-a', price: 1000, quantity: 1 }),
        sampleLine({ productId: 'prod-2', vendorId: 'vendor-a', price: 500, quantity: 2 }),
        sampleLine({
          productId: 'prod-3',
          vendorId: 'vendor-b',
          vendorName: 'Farm B',
          price: 300,
          quantity: 1,
        }),
      ],
    });

    const groups = groupCartByVendor(cart);
    expect(groups).toHaveLength(2);

    const farmA = groups.find((g) => g.vendorId === 'vendor-a');
    expect(farmA?.subtotal).toBe(2000);
    expect(farmA?.estimatedTax).toBe(Math.round((2000 * 625) / 10_000));
    expect(farmA?.platformFee).toBe(Math.round((2000 * PLATFORM_FEE_BPS) / 10_000));
    expect(farmA?.total).toBe(farmA!.subtotal + farmA!.estimatedTax + farmA!.platformFee);

    const farmB = groups.find((g) => g.vendorId === 'vendor-b');
    expect(farmB?.subtotal).toBe(300);
  });
});

describe('computeCartTotals', () => {
  it('returns zeroed totals for null or empty carts', () => {
    expect(computeCartTotals(null)).toEqual({
      itemCount: 0,
      subtotal: 0,
      estimatedTax: 0,
      platformFee: 0,
      grandTotal: 0,
      vendorGroups: [],
    });

    expect(computeCartTotals(sampleCart({ lines: [] }))).toEqual({
      itemCount: 0,
      subtotal: 0,
      estimatedTax: 0,
      platformFee: 0,
      grandTotal: 0,
      vendorGroups: [],
    });
  });

  it('aggregates subtotal, tax, platform fee, and grand total in cents', () => {
    const cart = sampleCart({
      marketState: 'CA',
      lines: [sampleLine({ price: 2000, quantity: 1 })],
    });

    const totals = computeCartTotals(cart);
    const expectedTax = Math.round((2000 * 725) / 10_000);
    const expectedFee = Math.round((2000 * PLATFORM_FEE_BPS) / 10_000);

    expect(totals).toMatchObject({
      itemCount: 1,
      subtotal: 2000,
      estimatedTax: expectedTax,
      platformFee: expectedFee,
      grandTotal: 2000 + expectedTax + expectedFee,
    });
    expect(totals.vendorGroups).toHaveLength(1);
  });
});

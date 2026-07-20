import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cartItemCount,
  computeCartTotals,
  createEmptyPresaleCart,
  estimateTaxBps,
  groupCartByVendor,
  loadPresaleCart,
  removePresaleLine,
  savePresaleCart,
  updatePresaleLineQuantity,
  upsertPresaleLine,
  type PresaleCart,
  type PresaleCartLine,
  type PresaleCartMarket,
} from './presale-cart';

const market: PresaleCartMarket = {
  id: 'market-1',
  name: 'Downtown Farmers Market',
  city: 'Chicago',
  state: 'IL',
  address: '123 Main St',
  start_datetime: '2026-07-12T14:00:00.000Z',
  end_datetime: '2026-07-12T20:00:00.000Z',
  timezone: 'America/Chicago',
  hours_summary: 'Sa 08:00-13:00',
};

function line(overrides: Partial<PresaleCartLine> = {}): PresaleCartLine {
  return {
    productId: 'prod-1',
    vendorId: 'vendor-1',
    vendorName: 'River Farm',
    name: 'Eggs',
    price: 500,
    quantity: 2,
    maxQuantity: 10,
    ...overrides,
  };
}

function cart(overrides: Partial<PresaleCart> = {}): PresaleCart {
  return {
    ...createEmptyPresaleCart(market),
    lines: [line()],
    ...overrides,
  };
}

describe('estimateTaxBps', () => {
  it('returns configured basis points for a valid state code', () => {
    expect(estimateTaxBps('IL')).toBe(625);
    expect(estimateTaxBps('ca')).toBe(725);
  });

  it('returns zero for unknown, empty, or undefined states', () => {
    expect(estimateTaxBps('ZZ')).toBe(0);
    expect(estimateTaxBps('')).toBe(0);
    expect(estimateTaxBps(undefined)).toBe(0);
    expect(estimateTaxBps(null)).toBe(0);
    expect(estimateTaxBps('   ')).toBe(0);
  });

  it('trims and uppercases state abbreviations', () => {
    expect(estimateTaxBps('  ny ')).toBe(800);
    expect(estimateTaxBps('ne')).toBe(550);
  });
});

describe('groupCartByVendor', () => {
  it('groups lines by vendor and computes subtotal, tax, platform fee, and total in cents', () => {
    const groups = groupCartByVendor(
      cart({
        lines: [
          line({ productId: 'a', price: 1000, quantity: 2 }),
          line({
            productId: 'b',
            vendorId: 'vendor-2',
            vendorName: 'Oak Grove',
            price: 300,
            quantity: 1,
          }),
        ],
      }),
    );

    expect(groups).toHaveLength(2);

    const riverFarm = groups.find((g) => g.vendorId === 'vendor-1');
    expect(riverFarm).toMatchObject({
      subtotal: 2000,
      estimatedTax: 125,
      platformFee: 100,
      total: 2225,
    });

    const oakGrove = groups.find((g) => g.vendorId === 'vendor-2');
    expect(oakGrove).toMatchObject({
      subtotal: 300,
      estimatedTax: 19,
      platformFee: 15,
      total: 334,
    });
  });

  it('returns an empty array when the cart has no lines', () => {
    expect(groupCartByVendor(cart({ lines: [] }))).toEqual([]);
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
    expect(computeCartTotals(cart({ lines: [] }))).toEqual({
      itemCount: 0,
      subtotal: 0,
      estimatedTax: 0,
      platformFee: 0,
      grandTotal: 0,
      vendorGroups: [],
    });
  });

  it('aggregates item count and grand total across vendor groups', () => {
    const totals = computeCartTotals(
      cart({
        lines: [
          line({ productId: 'a', quantity: 2, price: 1000 }),
          line({ productId: 'b', quantity: 1, price: 500 }),
        ],
      }),
    );

    expect(totals.itemCount).toBe(3);
    expect(totals.subtotal).toBe(2500);
    expect(totals.grandTotal).toBe(totals.subtotal + totals.estimatedTax + totals.platformFee);
  });
});

describe('cart line mutations', () => {
  it('upserts lines and clamps quantity between 1 and maxQuantity', () => {
    const next = upsertPresaleLine(cart({ lines: [] }), {
      ...line(),
      quantity: 99,
    });

    expect(next.lines[0].quantity).toBe(10);
  });

  it('defaults quantity to 1 when omitted', () => {
    const next = upsertPresaleLine(cart({ lines: [] }), {
      productId: 'prod-1',
      vendorId: 'vendor-1',
      vendorName: 'River Farm',
      name: 'Eggs',
      price: 500,
      maxQuantity: 5,
    });

    expect(next.lines[0].quantity).toBe(1);
  });

  it('updates quantity and removes the line when quantity drops to zero', () => {
    const updated = updatePresaleLineQuantity(cart(), 'prod-1', 0);
    expect(updated.lines).toHaveLength(0);
  });

  it('removes a line by product id', () => {
    const updated = removePresaleLine(cart(), 'prod-1');
    expect(updated.lines).toHaveLength(0);
  });
});

describe('presale cart storage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  it('returns null when storage is empty or invalid JSON', () => {
    expect(loadPresaleCart()).toBeNull();
    storage.set('vendorly-presale-cart', '{not-json');
    expect(loadPresaleCart()).toBeNull();
  });

  it('persists and reloads a cart', () => {
    const original = cart();
    savePresaleCart(original);
    const loaded = loadPresaleCart();

    expect(loaded?.marketId).toBe(original.marketId);
    expect(loaded?.lines).toHaveLength(1);
    expect(loaded?.updatedAt).toBeTruthy();
  });
});

describe('cartItemCount', () => {
  it('returns zero for null carts', () => {
    expect(cartItemCount(null)).toBe(0);
  });

  it('sums line quantities', () => {
    expect(
      cartItemCount(
        cart({
          lines: [
            line({ quantity: 2 }),
            line({ productId: 'prod-2', quantity: 3 }),
          ],
        }),
      ),
    ).toBe(5);
  });
});

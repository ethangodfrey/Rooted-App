import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cartLineCount,
  cartSubtotal,
  clearStorefrontCart,
  loadStorefrontCart,
  removeCartLine,
  saveStorefrontCart,
  upsertCartLine,
  type StorefrontCart,
} from './storefront-cart';

const VENDOR_ID = 'vendor-1';

function sampleCart(overrides: Partial<StorefrontCart> = {}): StorefrontCart {
  return {
    vendorId: VENDOR_ID,
    vendorName: 'River Farm',
    eventId: 'event-1',
    eventName: 'Saturday Market',
    updatedAt: '2026-07-10T12:00:00.000Z',
    lines: [
      { productId: 'p1', name: 'Eggs', price: 600, quantity: 2 },
      { productId: 'p2', name: 'Jam', price: 800, quantity: 1 },
    ],
    ...overrides,
  };
}

describe('storefront cart pure helpers', () => {
  it('counts total line quantities', () => {
    expect(cartLineCount(null)).toBe(0);
    expect(cartLineCount(sampleCart())).toBe(3);
    expect(cartLineCount(sampleCart({ lines: [] }))).toBe(0);
  });

  it('computes subtotal in cents', () => {
    expect(cartSubtotal(null)).toBe(0);
    expect(cartSubtotal(sampleCart())).toBe(2000);
    expect(cartSubtotal(sampleCart({ lines: [] }))).toBe(0);
  });

  it('upserts lines and enforces minimum quantity of 1', () => {
    const cart = sampleCart({ lines: [] });
    const updated = upsertCartLine(cart, {
      productId: 'p3',
      name: 'Bread',
      price: 500,
      quantity: 0,
    });

    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0]).toMatchObject({ productId: 'p3', quantity: 1 });
    expect(updated.updatedAt).not.toBe(cart.updatedAt);
  });

  it('replaces quantity when upserting an existing product', () => {
    const updated = upsertCartLine(sampleCart(), {
      productId: 'p1',
      name: 'Eggs',
      price: 600,
      quantity: 5,
    });

    expect(updated.lines.find((line) => line.productId === 'p1')?.quantity).toBe(5);
  });

  it('removes a line by product id', () => {
    const updated = removeCartLine(sampleCart(), 'p1');
    expect(updated.lines).toHaveLength(1);
    expect(updated.lines[0].productId).toBe('p2');
  });
});

describe('storefront cart localStorage persistence', () => {
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

  it('returns null when nothing is stored or JSON is invalid', () => {
    expect(loadStorefrontCart(VENDOR_ID)).toBeNull();
    storage.set('vendorly-cart:vendor-1', '{not-json');
    expect(loadStorefrontCart(VENDOR_ID)).toBeNull();
  });

  it('round-trips cart state through localStorage', () => {
    const cart = sampleCart();
    saveStorefrontCart(cart);
    const loaded = loadStorefrontCart(VENDOR_ID);

    expect(loaded?.vendorId).toBe(VENDOR_ID);
    expect(loaded?.lines).toHaveLength(2);
    expect(loaded?.updatedAt).not.toBe(cart.updatedAt);
  });

  it('clears stored carts for a vendor', () => {
    saveStorefrontCart(sampleCart());
    clearStorefrontCart(VENDOR_ID);
    expect(loadStorefrontCart(VENDOR_ID)).toBeNull();
  });
});

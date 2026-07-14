import { describe, expect, it } from 'vitest';

import { buildCheckoutPayload } from './cart-checkout-staging';
import type { PresaleCart } from './presale-cart';

function sampleCart(overrides: Partial<PresaleCart> = {}): PresaleCart {
  return {
    marketId: 'market-1',
    marketName: 'Downtown Market',
    marketCity: 'Springfield',
    marketState: 'IL',
    marketAddress: '123 Main St',
    pickupSchedule: {
      start_datetime: '2026-07-12T14:00:00.000Z',
      end_datetime: '2026-07-12T18:00:00.000Z',
      timezone: null,
      state: 'IL',
      hours_summary: null,
      sync_metadata: null,
    },
    updatedAt: '2026-07-10T12:00:00.000Z',
    lines: [
      {
        productId: 'prod-1',
        vendorId: 'vendor-1',
        vendorName: 'River Farm',
        name: 'Eggs',
        price: 600,
        quantity: 2,
        maxQuantity: 10,
      },
      {
        productId: 'prod-2',
        vendorId: 'vendor-2',
        vendorName: 'Baker Co',
        name: 'Bread',
        price: 500,
        quantity: 1,
        maxQuantity: 10,
      },
    ],
    ...overrides,
  };
}

describe('buildCheckoutPayload', () => {
  it('maps cart lines to checkout API inputs', () => {
    expect(buildCheckoutPayload(sampleCart())).toEqual([
      { productId: 'prod-1', eventId: 'market-1', quantity: 2, notes: undefined },
      { productId: 'prod-2', eventId: 'market-1', quantity: 1, notes: undefined },
    ]);
  });

  it('trims and forwards optional order notes', () => {
    expect(buildCheckoutPayload(sampleCart(), '  pickup at noon  ')).toEqual([
      { productId: 'prod-1', eventId: 'market-1', quantity: 2, notes: 'pickup at noon' },
      { productId: 'prod-2', eventId: 'market-1', quantity: 1, notes: 'pickup at noon' },
    ]);
  });

  it('returns an empty payload for an empty cart', () => {
    expect(buildCheckoutPayload(sampleCart({ lines: [] }))).toEqual([]);
  });

  it('omits notes when only whitespace is provided', () => {
    const payload = buildCheckoutPayload(sampleCart(), '   ');
    expect(payload.every((line) => line.notes === undefined)).toBe(true);
  });
});

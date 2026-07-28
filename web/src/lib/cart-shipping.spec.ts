import { describe, expect, it } from 'vitest';

import { computeShippingFeeCents, formatShippingAddressBlock } from './cart-shipping';

describe('computeShippingFeeCents', () => {
  it('sums flat-rate fees for shipping-enabled vendors', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: true,
        flatRateShippingFeeCents: 500,
        freeShippingMinimumCents: null,
      },
      {
        vendorId: 'v2',
        shippingEnabled: true,
        flatRateShippingFeeCents: 300,
        freeShippingMinimumCents: null,
      },
    ];
    const subtotals = new Map([
      ['v1', 2000],
      ['v2', 1500],
    ]);

    expect(computeShippingFeeCents(settings, subtotals)).toBe(800);
  });

  it('skips vendors with shipping disabled', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: false,
        flatRateShippingFeeCents: 500,
        freeShippingMinimumCents: null,
      },
    ];
    expect(computeShippingFeeCents(settings, new Map([['v1', 5000]]))).toBe(0);
  });

  it('waives shipping when subtotal meets the free-shipping threshold', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: true,
        flatRateShippingFeeCents: 600,
        freeShippingMinimumCents: 5000,
      },
    ];
    expect(computeShippingFeeCents(settings, new Map([['v1', 5000]]))).toBe(0);
    expect(computeShippingFeeCents(settings, new Map([['v1', 4999]]))).toBe(600);
  });

  it('treats missing vendor subtotals as zero', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: true,
        flatRateShippingFeeCents: 400,
        freeShippingMinimumCents: 1000,
      },
    ];
    expect(computeShippingFeeCents(settings, new Map())).toBe(400);
  });

  it('ignores zero or negative free-shipping thresholds', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: true,
        flatRateShippingFeeCents: 250,
        freeShippingMinimumCents: 0,
      },
    ];
    expect(computeShippingFeeCents(settings, new Map([['v1', 10_000]]))).toBe(250);
  });

  it('clamps negative flat-rate fees to zero contribution', () => {
    const settings = [
      {
        vendorId: 'v1',
        shippingEnabled: true,
        flatRateShippingFeeCents: -100,
        freeShippingMinimumCents: null,
      },
    ];
    expect(computeShippingFeeCents(settings, new Map([['v1', 1000]]))).toBe(0);
  });

  it('returns zero for empty settings', () => {
    expect(computeShippingFeeCents([], new Map())).toBe(0);
  });
});

describe('formatShippingAddressBlock', () => {
  it('formats a complete address block', () => {
    const block = formatShippingAddressBlock({
      name: 'Jane Doe',
      line1: '123 Main St',
      line2: 'Apt 4',
      city: 'Chicago',
      state: 'il',
      postalCode: '60601',
    });

    expect(block).toBe(
      'Ship to:\nJane Doe\n123 Main St\nApt 4\nChicago, IL 60601',
    );
  });

  it('omits blank line2 and trims whitespace', () => {
    const block = formatShippingAddressBlock({
      name: '  Jane Doe  ',
      line1: ' 123 Main St ',
      line2: '   ',
      city: ' Chicago ',
      state: ' il ',
      postalCode: ' 60601 ',
    });

    expect(block).toBe('Ship to:\nJane Doe\n123 Main St\nChicago, IL 60601');
  });
});

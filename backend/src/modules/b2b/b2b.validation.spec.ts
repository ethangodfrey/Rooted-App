import {
  parseVendorConnectionRequest,
  parseWholesaleProductCreate,
} from '@vendorly/env-config';

describe('b2b zod contracts', () => {
  it('accepts a valid connection request', () => {
    const parsed = parseVendorConnectionRequest({
      receiverVendorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects self-shaped invalid uuid', () => {
    const parsed = parseVendorConnectionRequest({ receiverVendorId: 'nope' });
    expect(parsed.OK).toBe(false);
  });

  it('accepts a wholesale SKU with fractional weight and tiers', () => {
    const parsed = parseWholesaleProductCreate({
      name: 'Heirloom Tomato Case',
      packagingUnit: 'case',
      weightLbs: 22.5,
      moq: 4,
      unitPriceCents: 4800,
      pricingTiers: [{ minQty: 10, unitPriceCents: 4200 }],
      freightNotes: 'Pallet freight available',
      pickupNotes: 'Dock 2 before 10:00',
    });
    expect(parsed.OK).toBe(true);
    if (!parsed.OK) return;
    expect(parsed.DATA.packagingUnit).toBe('CASE');
    expect(parsed.DATA.weightLbs).toBe(22.5);
  });

  it('rejects non-positive weight', () => {
    const parsed = parseWholesaleProductCreate({
      name: 'Bad',
      packagingUnit: 'LB',
      weightLbs: 0,
      moq: 1,
      unitPriceCents: 100,
    });
    expect(parsed.OK).toBe(false);
  });
});

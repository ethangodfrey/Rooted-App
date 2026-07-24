import {
  isPeerRelationshipBlocked,
  resolveWholesalePricingMode,
  retailPriceToCents,
} from './wholesale-relationship.util';

describe('resolveWholesalePricingMode', () => {
  it('returns tiered wholesale pricing for accepted peer relationships', () => {
    expect(resolveWholesalePricingMode('ACCEPTED')).toBe('TIERED_WHOLESALE_PRICING');
  });

  it('returns standard pricing for pending, blocked, or missing relationships', () => {
    expect(resolveWholesalePricingMode('PENDING')).toBe('STANDARD');
    expect(resolveWholesalePricingMode('BLOCKED')).toBe('STANDARD');
    expect(resolveWholesalePricingMode(null)).toBe('STANDARD');
  });
});

describe('isPeerRelationshipBlocked', () => {
  it('returns true only for blocked relationships', () => {
    expect(isPeerRelationshipBlocked('BLOCKED')).toBe(true);
    expect(isPeerRelationshipBlocked('ACCEPTED')).toBe(false);
    expect(isPeerRelationshipBlocked(null)).toBe(false);
  });
});

describe('retailPriceToCents', () => {
  it('converts numeric retail prices to integer cents', () => {
    expect(retailPriceToCents(12.5)).toBe(1250);
    expect(retailPriceToCents(0)).toBe(0);
    expect(retailPriceToCents(9.995)).toBe(999);
  });

  it('converts numeric strings and decimal-like objects', () => {
    expect(retailPriceToCents('4.25')).toBe(425);
    expect(
      retailPriceToCents({
        toNumber: () => 3.99,
      }),
    ).toBe(399);
  });

  it('returns null for empty, invalid, or negative inputs', () => {
    expect(retailPriceToCents(null)).toBeNull();
    expect(retailPriceToCents(undefined)).toBeNull();
    expect(retailPriceToCents('')).toBe(0);
    expect(retailPriceToCents('not-a-price')).toBeNull();
    expect(retailPriceToCents(-1)).toBeNull();
    expect(retailPriceToCents(Number.NaN)).toBeNull();
    expect(retailPriceToCents(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

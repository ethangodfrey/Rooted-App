import { describe, expect, it } from 'vitest';

import {
  buildPricingTierBands,
  evaluateWholesalePricing,
  normalizePricingTiers,
  resolveUnitPriceCents,
} from './pricing';

describe('wholesale tiered pricing calculator', () => {
  const tiers = [
    { minQty: 50, unitPriceCents: 2200 },
    { minQty: 100, unitPriceCents: 2000 },
  ];

  it('builds inclusive quantity bands for base and volume tiers', () => {
    const bands = buildPricingTierBands(2400, tiers);
    expect(bands).toEqual([
      expect.objectContaining({ minQty: 1, maxQty: 49, unitPriceCents: 2400 }),
      expect.objectContaining({ minQty: 50, maxQty: 99, unitPriceCents: 2200 }),
      expect.objectContaining({ minQty: 100, maxQty: null, unitPriceCents: 2000 }),
    ]);
  });

  it('matches tier 1 and tier 2 volume prices', () => {
    const base = resolveUnitPriceCents(10, 2400, tiers, 5);
    expect(base.tierLabel).toBe('BASE_RATE');
    expect(base.unitPriceCents).toBe(2400);

    const tier1 = resolveUnitPriceCents(50, 2400, tiers, 5);
    expect(tier1.tierMinQty).toBe(50);
    expect(tier1.unitPriceCents).toBe(2200);

    const tier2 = resolveUnitPriceCents(120, 2400, tiers, 5);
    expect(tier2.tierMinQty).toBe(100);
    expect(tier2.unitPriceCents).toBe(2000);
  });

  it('activates MOQ guard below minimum_order_quantity', () => {
    const evaled = evaluateWholesalePricing({
      quantity: 2,
      moq: 5,
      baseUnitPriceCents: 2400,
      tiersRaw: tiers,
    });
    expect(evaled.moqGuardActive).toBe(true);
    expect(evaled.moqSatisfied).toBe(false);
    expect(evaled.lineTotalCents).toBe(0);
  });

  it('computes live line total when MOQ satisfied and tier matched', () => {
    const evaled = evaluateWholesalePricing({
      quantity: 100,
      moq: 5,
      baseUnitPriceCents: 2400,
      tiersRaw: tiers,
    });
    expect(evaled.moqGuardActive).toBe(false);
    expect(evaled.tierLabel).toBe('TIER_100');
    expect(evaled.lineTotalCents).toBe(2000 * 100);
  });

  it('normalizes invalid or empty tier payloads to an empty list', () => {
    expect(normalizePricingTiers(undefined)).toEqual([]);
    expect(normalizePricingTiers(null)).toEqual([]);
    expect(normalizePricingTiers('not-an-array')).toEqual([]);
    expect(normalizePricingTiers([{ minQty: 0, unitPriceCents: 100 }])).toEqual([]);
    expect(normalizePricingTiers([{ minQty: 50, unitPriceCents: -1 }])).toEqual([]);
    expect(normalizePricingTiers([{ min_qty: 50, unit_price_cents: 2200 }])).toEqual([
      { minQty: 50, unitPriceCents: 2200 },
    ]);
  });
});

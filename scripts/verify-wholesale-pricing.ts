/**
 * Wholesale MOQ + tiered pricing calculator verification.
 *
 * Usage:
 *   npm run test:wholesale:pricing
 *
 * Success lines (uppercase, no emoji):
 *   PRICING_TIER_MATCHED
 *   MOQ_GUARD_ACTIVE
 *   WHOLESALE_PRICING_VERIFIED
 */

import {
  buildPricingTierBands,
  evaluateWholesalePricing,
  resolveUnitPriceCents,
} from '../tenant-web/src/lib/b2b/pricing';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const tiers = [
    { minQty: 50, unitPriceCents: 2200 },
    { minQty: 100, unitPriceCents: 2000 },
  ];

  const bands = buildPricingTierBands(2400, tiers);
  assert(bands[0]?.maxQty === 49, 'BAND_FAIL BASE_MAX');
  assert(bands[1]?.minQty === 50 && bands[1]?.maxQty === 99, 'BAND_FAIL TIER1');
  assert(bands[2]?.minQty === 100 && bands[2]?.maxQty == null, 'BAND_FAIL TIER2');

  const tier2 = resolveUnitPriceCents(120, 2400, tiers, 5);
  assert(tier2.unitPriceCents === 2000, 'TIER_FAIL UNIT');
  assert(tier2.tierLabel === 'TIER_100', 'TIER_FAIL LABEL');
  log('PRICING_TIER_MATCHED TIER=TIER_100 UNIT_CENTS=2000');

  const guarded = evaluateWholesalePricing({
    quantity: 2,
    moq: 5,
    baseUnitPriceCents: 2400,
    tiersRaw: tiers,
  });
  assert(guarded.moqGuardActive, 'MOQ_FAIL GUARD');
  assert(guarded.lineTotalCents === 0, 'MOQ_FAIL LINE');
  log('MOQ_GUARD_ACTIVE QTY=2 MOQ=5');

  const ok = evaluateWholesalePricing({
    quantity: 100,
    moq: 5,
    baseUnitPriceCents: 2400,
    tiersRaw: tiers,
  });
  assert(!ok.moqGuardActive, 'MOQ_FAIL SATISFIED');
  assert(ok.lineTotalCents === 200_000, 'TOTAL_FAIL');
  log('PRICING_TIER_MATCHED TIER=TIER_100 LINE_CENTS=200000');

  log('WHOLESALE_PRICING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_PRICING_FAILED ${message}`);
  process.exitCode = 1;
}

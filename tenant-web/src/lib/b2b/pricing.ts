import type { WholesalePricingTier } from './types';

export function normalizePricingTiers(raw: unknown): WholesalePricingTier {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null;
      const row = tier as Record<string, unknown>;
      const minQty = Number(row.minQty);
      const unitPriceCents = Number(row.unitPriceCents);
      if (!Number.isFinite(minQty) || !Number.isFinite(unitPriceCents)) return null;
      if (minQty < 1 || unitPriceCents < 0) return null;
      return { minQty: Math.floor(minQty), unitPriceCents: Math.floor(unitPriceCents) };
    })
    .filter((tier): tier is { minQty: number; unitPriceCents: number } => tier !== null)
    .sort((a, b) => a.minQty - b.minQty);
}

/** Resolve unit price for a requested quantity using MOQ base + volume tiers. */
export function resolveUnitPriceCents(
  quantity: number,
  baseUnitPriceCents: number,
  tiersRaw: unknown,
): { unitPriceCents: number; tierMinQty: number | null; moqGuardActive: boolean } {
  const qty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const tiers = normalizePricingTiers(tiersRaw);
  let unitPriceCents = baseUnitPriceCents;
  let tierMinQty: number | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      unitPriceCents = tier.unitPriceCents;
      tierMinQty = tier.minQty;
    }
  }
  return {
    unitPriceCents,
    tierMinQty,
    moqGuardActive: qty > 0,
  };
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

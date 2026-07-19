import type { WholesalePricingTier } from './types';

export type PricingTierBand = {
  minQty: number;
  maxQty: number | null;
  unitPriceCents: number;
  label: string;
};

export type PricingEvaluation = {
  quantity: number;
  moq: number;
  unitPriceCents: number;
  lineTotalCents: number;
  tierMinQty: number | null;
  tierLabel: string;
  moqGuardActive: boolean;
  moqSatisfied: boolean;
  bands: PricingTierBand[];
};

export function normalizePricingTiers(raw: unknown): WholesalePricingTier {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((tier) => {
      if (!tier || typeof tier !== 'object') return null;
      const row = tier as Record<string, unknown>;
      const minQty = Number(row.minQty ?? row.min_qty);
      const unitPriceCents = Number(row.unitPriceCents ?? row.unit_price_cents);
      if (!Number.isFinite(minQty) || !Number.isFinite(unitPriceCents)) return null;
      if (minQty < 1 || unitPriceCents < 0) return null;
      return { minQty: Math.floor(minQty), unitPriceCents: Math.floor(unitPriceCents) };
    })
    .filter((tier): tier is { minQty: number; unitPriceCents: number } => tier !== null)
    .sort((a, b) => a.minQty - b.minQty);
}

/**
 * Build inclusive quantity bands for display:
 * Base (1–49), Tier 1 (50–99), Tier 2 (100+), etc.
 */
export function buildPricingTierBands(
  baseUnitPriceCents: number,
  tiersRaw: unknown,
): PricingTierBand[] {
  const tiers = normalizePricingTiers(tiersRaw);
  const bands: PricingTierBand[] = [];

  const firstBreak = tiers[0]?.minQty ?? null;
  bands.push({
    minQty: 1,
    maxQty: firstBreak != null ? Math.max(1, firstBreak - 1) : null,
    unitPriceCents: baseUnitPriceCents,
    label: firstBreak != null ? `BASE 1-${firstBreak - 1}` : 'BASE 1+',
  });

  for (let i = 0; i < tiers.length; i += 1) {
    const tier = tiers[i]!;
    const next = tiers[i + 1];
    const maxQty = next ? next.minQty - 1 : null;
    bands.push({
      minQty: tier.minQty,
      maxQty: maxQty != null && maxQty >= tier.minQty ? maxQty : null,
      unitPriceCents: tier.unitPriceCents,
      label:
        maxQty != null && maxQty >= tier.minQty
          ? `TIER ${tier.minQty}-${maxQty}`
          : `TIER ${tier.minQty}+`,
    });
  }

  return bands;
}

/** Resolve unit price for a requested quantity using base + volume tiers. */
export function resolveUnitPriceCents(
  quantity: number,
  baseUnitPriceCents: number,
  tiersRaw: unknown,
  moq = 1,
): {
  unitPriceCents: number;
  tierMinQty: number | null;
  tierLabel: string;
  moqGuardActive: boolean;
  moqSatisfied: boolean;
} {
  const qty = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  const minimum = Number.isFinite(moq) && moq > 0 ? Math.floor(moq) : 1;
  const tiers = normalizePricingTiers(tiersRaw);
  let unitPriceCents = baseUnitPriceCents;
  let tierMinQty: number | null = null;

  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      unitPriceCents = tier.unitPriceCents;
      tierMinQty = tier.minQty;
    }
  }

  const moqSatisfied = qty >= minimum;
  const moqGuardActive = qty > 0 && !moqSatisfied;

  return {
    unitPriceCents,
    tierMinQty,
    tierLabel: tierMinQty != null ? `TIER_${tierMinQty}` : 'BASE_RATE',
    moqGuardActive,
    moqSatisfied,
  };
}

/** Full live evaluation for catalog grid rows. */
export function evaluateWholesalePricing(input: {
  quantity: number;
  moq: number;
  baseUnitPriceCents: number;
  tiersRaw: unknown;
}): PricingEvaluation {
  const quantity = Number.isFinite(input.quantity)
    ? Math.max(0, Math.floor(input.quantity))
    : 0;
  const moq = Number.isFinite(input.moq) && input.moq > 0 ? Math.floor(input.moq) : 1;
  const priced = resolveUnitPriceCents(
    quantity,
    input.baseUnitPriceCents,
    input.tiersRaw,
    moq,
  );
  const bands = buildPricingTierBands(input.baseUnitPriceCents, input.tiersRaw);
  const lineTotalCents =
    priced.moqGuardActive || quantity === 0 ? 0 : priced.unitPriceCents * quantity;

  return {
    quantity,
    moq,
    unitPriceCents: priced.unitPriceCents,
    lineTotalCents,
    tierMinQty: priced.tierMinQty,
    tierLabel: priced.tierLabel,
    moqGuardActive: priced.moqGuardActive,
    moqSatisfied: priced.moqSatisfied,
    bands,
  };
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function formatTierBandRange(band: PricingTierBand): string {
  if (band.maxQty == null) return `${band.minQty}+`;
  if (band.maxQty <= band.minQty) return `${band.minQty}+`;
  return `${band.minQty}-${band.maxQty}`;
}

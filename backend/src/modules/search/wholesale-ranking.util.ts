export type RankableWholesaleHit = {
  id: string;
  vendorId: string;
  name: string;
  score?: number;
  /** Miles from buyer origin when proximity search is active. */
  distanceMiles?: number | null;
};

export type RankedWholesaleHit<T extends RankableWholesaleHit> = T & {
  baseScore: number;
  boostApplied: number;
  proximityBoost: number;
  score: number;
  CONNECTED_WHOLESALER: boolean;
  distanceMiles: number | null;
};

/** Multiplicative CONNECTED_WHOLESALERS boost — enhances relevance, does not override it. */
export const CONNECTED_WHOLESALER_SCORE_MULTIPLIER = 1.2;

/**
 * Max additive proximity weight (distance 0 → multiplier 1 + weight).
 * finalScore = baseScore * connectedBoost * proximityBoost
 */
export const PROXIMITY_SCORE_WEIGHT = 0.15;

export type ScoreComposition = {
  ID: string;
  VENDOR_ID: string;
  BASE_SCORE: number;
  BOOST_APPLIED: number;
  PROXIMITY_BOOST: number;
  FINAL_SCORE: number;
  CONNECTED_WHOLESALER: boolean;
  DISTANCE_MILES?: number | null;
};

function toConnectedSet(
  connectedVendorIds: ReadonlySet<string> | readonly string[],
): Set<string> {
  return connectedVendorIds instanceof Set
    ? connectedVendorIds
    : new Set(connectedVendorIds);
}

function numericBaseScore(score: unknown): number {
  const value = typeof score === 'number' ? score : Number(score);
  return Number.isFinite(value) ? value : 0;
}

/**
 * Closer vendors within radius get a higher multiplicative proximity factor.
 * Outside / missing distance → identity (1).
 */
export function proximityBoostMultiplier(
  distanceMiles: number | null | undefined,
  radiusMiles: number | null | undefined,
  weight: number = PROXIMITY_SCORE_WEIGHT,
): number {
  if (
    distanceMiles == null ||
    radiusMiles == null ||
    !Number.isFinite(distanceMiles) ||
    !Number.isFinite(radiusMiles) ||
    radiusMiles <= 0
  ) {
    return 1;
  }
  const safeWeight = Number.isFinite(weight) && weight >= 0 ? weight : 0;
  const clamped = Math.min(Math.max(distanceMiles, 0), radiusMiles);
  const closeness = 1 - clamped / radiusMiles;
  return 1 + safeWeight * closeness;
}

export type RankWholesaleHitsOptions = {
  connectedMultiplier?: number;
  radiusMiles?: number | null;
  proximityWeight?: number;
};

/**
 * Hybrid ranking:
 * finalScore = baseScore * connectedBoost * proximityBoost
 * - CONNECTED_WHOLESALERS → connectedMultiplier (default 1.2)
 * - Proximity → up to +PROXIMITY_SCORE_WEIGHT when distance → 0
 * Empty connected set applies no connection boost/penalty.
 */
export function rankWholesaleHitsByConnectedVendors<
  T extends RankableWholesaleHit,
>(
  hits: T[],
  connectedVendorIds: ReadonlySet<string> | readonly string[],
  multiplier: number = CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
  options: RankWholesaleHitsOptions = {},
): Array<RankedWholesaleHit<T>> {
  const connected = toConnectedSet(connectedVendorIds);
  const safeMultiplier =
    Number.isFinite(options.connectedMultiplier ?? multiplier) &&
    (options.connectedMultiplier ?? multiplier) > 0
      ? (options.connectedMultiplier ?? multiplier)
      : 1;
  const radiusMiles = options.radiusMiles ?? null;
  const proximityWeight = options.proximityWeight ?? PROXIMITY_SCORE_WEIGHT;

  const scored = hits.map((hit) => {
    const baseScore = numericBaseScore(hit.score);
    const isConnected = connected.has(hit.vendorId);
    const boostApplied =
      connected.size > 0 && isConnected ? safeMultiplier : 1;
    const distanceMiles =
      hit.distanceMiles == null || !Number.isFinite(hit.distanceMiles)
        ? null
        : hit.distanceMiles;
    const proximityBoost = proximityBoostMultiplier(
      distanceMiles,
      radiusMiles,
      proximityWeight,
    );
    const finalScore = baseScore * boostApplied * proximityBoost;
    return {
      ...hit,
      baseScore,
      boostApplied,
      proximityBoost,
      score: finalScore,
      CONNECTED_WHOLESALER: isConnected,
      distanceMiles,
    };
  });

  return scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (
      a.distanceMiles != null &&
      b.distanceMiles != null &&
      a.distanceMiles !== b.distanceMiles
    ) {
      return a.distanceMiles - b.distanceMiles;
    }
    return a.name.localeCompare(b.name);
  });
}

export function countBoostedHits<
  T extends { CONNECTED_WHOLESALER?: boolean; vendorId: string },
>(
  hits: T[],
  connectedVendorIds: ReadonlySet<string> | readonly string[],
): number {
  const connected = toConnectedSet(connectedVendorIds);
  if (connected.size === 0) return 0;
  return hits.filter(
    (hit) =>
      hit.CONNECTED_WHOLESALER === true || connected.has(hit.vendorId),
  ).length;
}

export function buildScoreCompositionLog(hit: ScoreComposition): string {
  const distance =
    hit.DISTANCE_MILES == null
      ? 'NA'
      : Number(hit.DISTANCE_MILES).toFixed(3);
  return `SEARCH_SCORE_CALCULATED ID=${hit.ID} VENDOR=${hit.VENDOR_ID} BASE=${hit.BASE_SCORE} BOOST=${hit.BOOST_APPLIED} PROXIMITY=${hit.PROXIMITY_BOOST} FINAL=${hit.FINAL_SCORE} CONNECTED=${hit.CONNECTED_WHOLESALER ? '1' : '0'} DISTANCE_MI=${distance}`;
}

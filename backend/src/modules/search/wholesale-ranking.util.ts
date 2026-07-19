export type RankableWholesaleHit = {
  id: string;
  vendorId: string;
  name: string;
  score?: number;
};

export type RankedWholesaleHit<T extends RankableWholesaleHit> = T & {
  baseScore: number;
  boostApplied: number;
  score: number;
  CONNECTED_WHOLESALER: boolean;
};

/** Multiplicative CONNECTED_WHOLESALERS boost — enhances relevance, does not override it. */
export const CONNECTED_WHOLESALER_SCORE_MULTIPLIER = 1.2;

export type ScoreComposition = {
  ID: string;
  VENDOR_ID: string;
  BASE_SCORE: number;
  BOOST_APPLIED: number;
  FINAL_SCORE: number;
  CONNECTED_WHOLESALER: boolean;
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
 * Hybrid ranking: finalScore = baseScore * 1.2 for CONNECTED_WHOLESALERS,
 * otherwise finalScore = baseScore. Empty connected set applies no boost/penalty.
 * Telemetry: RANKING_ALGORITHM_REFINED, SEARCH_SCORE_CALCULATED
 */
export function rankWholesaleHitsByConnectedVendors<
  T extends RankableWholesaleHit,
>(
  hits: T[],
  connectedVendorIds: ReadonlySet<string> | readonly string[],
  multiplier: number = CONNECTED_WHOLESALER_SCORE_MULTIPLIER,
): Array<RankedWholesaleHit<T>> {
  const connected = toConnectedSet(connectedVendorIds);
  const safeMultiplier =
    Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;

  const scored = hits.map((hit) => {
    const baseScore = numericBaseScore(hit.score);
    const isConnected = connected.has(hit.vendorId);
    // Empty CONNECTED_WHOLESALERS → identity (raw relevance, no penalty).
    const boostApplied =
      connected.size > 0 && isConnected ? safeMultiplier : 1;
    const finalScore = baseScore * boostApplied;
    return {
      ...hit,
      baseScore,
      boostApplied,
      score: finalScore,
      CONNECTED_WHOLESALER: isConnected,
    };
  });

  return scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });
}

export function countBoostedHits<T extends { CONNECTED_WHOLESALER?: boolean; vendorId: string }>(
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

export function buildScoreCompositionLog(
  hit: ScoreComposition,
): string {
  return `SEARCH_SCORE_CALCULATED ID=${hit.ID} VENDOR=${hit.VENDOR_ID} BASE=${hit.BASE_SCORE} BOOST=${hit.BOOST_APPLIED} FINAL=${hit.FINAL_SCORE} CONNECTED=${hit.CONNECTED_WHOLESALER ? '1' : '0'}`;
}

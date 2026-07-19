export type RankableWholesaleHit = {
  id: string;
  vendorId: string;
  name: string;
  score?: number;
};

/**
 * Relationship-aware ranking: connected wholesalers sort ahead of others,
 * then by descending score / name.
 * Telemetry companion: RANKING_ALGORITHM_OPTIMIZED
 */
export function rankWholesaleHitsByConnectedVendors<
  T extends RankableWholesaleHit,
>(hits: T[], connectedVendorIds: ReadonlySet<string> | readonly string[]): T[] {
  const connected =
    connectedVendorIds instanceof Set
      ? connectedVendorIds
      : new Set(connectedVendorIds);

  return [...hits].sort((a, b) => {
    const aBoost = connected.has(a.vendorId) ? 1 : 0;
    const bBoost = connected.has(b.vendorId) ? 1 : 0;
    if (aBoost !== bBoost) return bBoost - aBoost;

    const aScore = Number.isFinite(a.score) ? (a.score as number) : 0;
    const bScore = Number.isFinite(b.score) ? (b.score as number) : 0;
    if (aScore !== bScore) return bScore - aScore;

    return a.name.localeCompare(b.name);
  });
}

export function countBoostedHits<T extends RankableWholesaleHit>(
  hits: T[],
  connectedVendorIds: ReadonlySet<string> | readonly string[],
): number {
  const connected =
    connectedVendorIds instanceof Set
      ? connectedVendorIds
      : new Set(connectedVendorIds);
  return hits.filter((hit) => connected.has(hit.vendorId)).length;
}

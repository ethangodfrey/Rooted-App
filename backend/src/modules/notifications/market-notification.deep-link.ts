/**
 * Deep linking contract for shopper notifications and market navigation.
 * Canonical paths: /markets/:market_id and /vendors/:vendor_id
 * Telemetry: DEEP_LINKING_VERIFIED
 */

export const MARKET_DEEP_LINK_PREFIX = '/markets' as const;
export const VENDOR_DEEP_LINK_PREFIX = '/vendors' as const;

export function marketDeepLink(marketId: string): string {
  const id = marketId.trim();
  if (!id) {
    throw new Error('DEEP_LINK_INVALID MARKET_ID_EMPTY');
  }
  return `${MARKET_DEEP_LINK_PREFIX}/${id}`;
}

export function vendorDeepLink(vendorId: string, marketId?: string): string {
  const id = vendorId.trim();
  if (!id) {
    throw new Error('DEEP_LINK_INVALID VENDOR_ID_EMPTY');
  }
  const base = `${VENDOR_DEEP_LINK_PREFIX}/${id}`;
  const market = (marketId ?? '').trim();
  if (!market) return base;
  return `${base}?market=${encodeURIComponent(market)}`;
}

export function parseMarketIdFromDeepLink(deepLink: string): string | null {
  const trimmed = deepLink.trim();
  const match = trimmed.match(/^\/markets\/([0-9a-fA-F-]{36})(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export function parseVendorIdFromDeepLink(deepLink: string): string | null {
  const trimmed = deepLink.trim();
  const match = trimmed.match(/^\/vendors\/([0-9a-fA-F-]{36})(?:\?.*)?$/);
  return match?.[1] ?? null;
}

export type MarketAlertPayload = {
  market_id: string;
  deep_link: string;
  distance_km?: number;
};

export function buildMarketAlertPayload(input: {
  marketId: string;
  distanceKm?: number;
}): MarketAlertPayload {
  const deep_link = marketDeepLink(input.marketId);
  return {
    market_id: input.marketId,
    deep_link,
    ...(input.distanceKm != null && Number.isFinite(input.distanceKm)
      ? { distance_km: Number(input.distanceKm.toFixed(3)) }
      : {}),
  };
}

export function formatDeepLinkingVerifiedLog(input: {
  marketId: string;
  deepLink: string;
}): string {
  return `DEEP_LINKING_VERIFIED MARKET_ID=${input.marketId} DEEP_LINK=${input.deepLink}`;
}

/** Haversine distance in kilometers (WGS84). */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isWithinAlertRadiusKm(
  shopper: { latitude: number; longitude: number },
  market: { latitude: number; longitude: number },
  alertRadiusKm: number,
): { within: boolean; distanceKm: number } {
  const d = distanceKm(shopper, market);
  return {
    within: d <= alertRadiusKm,
    distanceKm: d,
  };
}

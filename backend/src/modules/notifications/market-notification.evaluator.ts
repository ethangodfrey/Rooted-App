/**
 * Pure evaluation of location-aware market alert eligibility.
 * Used by MarketNotificationService and integration tests.
 */

import {
  buildMarketAlertPayload,
  isWithinAlertRadiusKm,
  marketDeepLink,
  type MarketAlertPayload,
} from './market-notification.deep-link';

export type ShopperAlertCandidate = {
  userId: string;
  enableMarketAlerts: boolean;
  alertRadiusKm: number;
  latitude: number;
  longitude: number;
};

export type MarketEventStart = {
  marketId: string;
  name: string;
  startDatetime: Date;
  latitude: number;
  longitude: number;
};

export type MarketAlertDecision = {
  userId: string;
  marketId: string;
  distanceKm: number;
  payload: MarketAlertPayload;
  title: string;
  body: string;
};

export function evaluateMarketAlert(
  shopper: ShopperAlertCandidate,
  market: MarketEventStart,
): MarketAlertDecision | null {
  if (!shopper.enableMarketAlerts) return null;
  if (!(shopper.alertRadiusKm > 0)) return null;

  const { within, distanceKm } = isWithinAlertRadiusKm(
    { latitude: shopper.latitude, longitude: shopper.longitude },
    { latitude: market.latitude, longitude: market.longitude },
    shopper.alertRadiusKm,
  );
  if (!within) return null;

  const payload = buildMarketAlertPayload({
    marketId: market.marketId,
    distanceKm,
  });

  return {
    userId: shopper.userId,
    marketId: market.marketId,
    distanceKm,
    payload,
    title: 'MARKET_ALERT',
    body: `${market.name} is starting near you (${distanceKm.toFixed(1)} km). Open ${marketDeepLink(market.marketId)}`,
  };
}

export function evaluateMarketAlertsForShopper(
  shopper: ShopperAlertCandidate,
  markets: MarketEventStart[],
): MarketAlertDecision[] {
  const decisions: MarketAlertDecision[] = [];
  for (const market of markets) {
    const decision = evaluateMarketAlert(shopper, market);
    if (decision) decisions.push(decision);
  }
  return decisions;
}

/** Events whose start falls in [now, now + lookAheadMs] or started within lookBackMs. */
export function filterMarketsStartingSoon(
  markets: MarketEventStart[],
  now: Date,
  lookAheadMs = 30 * 60 * 1000,
  lookBackMs = 5 * 60 * 1000,
): MarketEventStart[] {
  const start = now.getTime() - lookBackMs;
  const end = now.getTime() + lookAheadMs;
  return markets.filter((m) => {
    const t = m.startDatetime.getTime();
    return t >= start && t <= end;
  });
}

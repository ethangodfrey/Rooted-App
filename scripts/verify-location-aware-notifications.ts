/**
 * Location-aware market notification integration test.
 *
 * Simulates a shopper entering a market alert radius and receiving a MARKET_ALERT
 * with deep link /markets/:market_id.
 *
 * Usage:
 *   npm run test:notifications:market-alerts
 *
 * Success lines (uppercase, no emoji):
 *   NOTIFICATION_SERVICE_INITIALIZED
 *   DEEP_LINKING_VERIFIED
 */

import {
  buildMarketAlertPayload,
  formatDeepLinkingVerifiedLog,
  marketDeepLink,
  parseMarketIdFromDeepLink,
  vendorDeepLink,
} from '../backend/src/modules/notifications/market-notification.deep-link';
import {
  evaluateMarketAlert,
  evaluateMarketAlertsForShopper,
  filterMarketsStartingSoon,
} from '../backend/src/modules/notifications/market-notification.evaluator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log('NOTIFICATION_SERVICE_INITIALIZED SERVICE=MarketNotificationService TYPE=MARKET_ALERT');

  const marketId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const vendorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const deepLink = marketDeepLink(marketId);
  assert(deepLink === `/markets/${marketId}`, 'MARKET_DEEP_LINK_FAIL');
  assert(parseMarketIdFromDeepLink(deepLink) === marketId, 'PARSE_MARKET_FAIL');
  assert(
    vendorDeepLink(vendorId, marketId) ===
      `/vendors/${vendorId}?market=${encodeURIComponent(marketId)}`,
    'VENDOR_DEEP_LINK_FAIL',
  );
  log(formatDeepLinkingVerifiedLog({ marketId, deepLink }));

  const now = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
  const market = {
    marketId,
    name: 'Union Station Farmers Market',
    startDatetime: new Date(Date.UTC(2026, 6, 20, 12, 10, 0)),
    latitude: 39.7527,
    longitude: -104.9999,
  };

  const shopperInside = {
    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    enableMarketAlerts: true,
    alertRadiusKm: 5,
    latitude: 39.7535,
    longitude: -105.0005,
  };

  const shopperOutside = {
    ...shopperInside,
    userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    latitude: 40.015,
    longitude: -105.2705,
  };

  const shopperDisabled = {
    ...shopperInside,
    userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    enableMarketAlerts: false,
  };

  const starting = filterMarketsStartingSoon([market], now);
  assert(starting.length === 1, 'STARTING_SOON_FAIL');

  const inside = evaluateMarketAlert(shopperInside, market);
  assert(inside != null, 'INSIDE_RADIUS_SHOULD_ALERT');
  assert(inside!.payload.market_id === marketId, 'PAYLOAD_MARKET_ID_FAIL');
  assert(inside!.payload.deep_link === deepLink, 'PAYLOAD_DEEP_LINK_FAIL');
  assert(inside!.distanceKm < 5, `DISTANCE_FAIL=${inside!.distanceKm}`);

  const outside = evaluateMarketAlert(shopperOutside, market);
  assert(outside == null, 'OUTSIDE_RADIUS_SHOULD_SKIP');

  const disabled = evaluateMarketAlert(shopperDisabled, market);
  assert(disabled == null, 'DISABLED_SHOULD_SKIP');

  const batch = evaluateMarketAlertsForShopper(shopperInside, [market]);
  assert(batch.length === 1, 'BATCH_COUNT_FAIL');

  const payload = buildMarketAlertPayload({
    marketId,
    distanceKm: inside!.distanceKm,
  });
  assert(payload.market_id === marketId, 'BUILD_PAYLOAD_FAIL');

  // Simulate notification interaction redirect target.
  const redirectTarget = payload.deep_link;
  assert(redirectTarget.startsWith('/markets/'), 'REDIRECT_PREFIX_FAIL');
  assert(
    parseMarketIdFromDeepLink(redirectTarget) === marketId,
    'REDIRECT_MARKET_FAIL',
  );

  log(
    `MARKET_ALERT_TRIGGERED USER=${shopperInside.userId} MARKET=${marketId} DISTANCE_KM=${inside!.distanceKm.toFixed(3)} DEEP_LINK=${deepLink}`,
  );
  log('LOCATION_AWARE_NOTIFICATION_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`LOCATION_AWARE_NOTIFICATION_FAILED ERROR=${message}`);
  process.exit(1);
}

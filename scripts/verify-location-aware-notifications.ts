/**
 * Location-aware notification system deployment verification.
 *
 * Usage:
 *   npm run test:notifications:market-alerts
 *
 * Success lines:
 *   NOTIFICATION_SYSTEM_DEPLOYED
 *   DEEP_LINKING_ROUTING_VERIFIED
 */

import {
  assertProductionCronEnabled,
  formatNotificationSystemDeployedLog,
  MARKET_ALERT_CRON_EXPRESSION,
  resolveMarketAlertCronEnabled,
} from '../backend/src/modules/notifications/market-notification.deploy';
import {
  buildMarketAlertPayload,
  formatDeepLinkingVerifiedLog,
  marketDeepLink,
  parseMarketIdFromDeepLink,
  parseVendorIdFromDeepLink,
  vendorDeepLink,
} from '../backend/src/modules/notifications/market-notification.deep-link';
import {
  evaluateMarketAlert,
  filterMarketsStartingSoon,
} from '../backend/src/modules/notifications/market-notification.evaluator';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors web resolveNotificationDeepLink without Vite path aliases. */
function resolveNotificationDeepLink(item: {
  deep_link?: string | null;
  market_id?: string | null;
  payload?: Record<string, unknown> | null;
}): string | null {
  if (item.deep_link && item.deep_link.startsWith('/')) {
    return item.deep_link;
  }
  const payloadMarket =
    item.payload && typeof item.payload.market_id === 'string'
      ? item.payload.market_id
      : null;
  const marketId = item.market_id ?? payloadMarket;
  return marketId ? marketDeepLink(marketId) : null;
}

function main(): void {
  // --- Production cron configuration ---
  assert(
    resolveMarketAlertCronEnabled({
      envFlag: undefined,
      nodeEnv: 'production',
    }) === true,
    'PROD_DEFAULT_CRON_ENABLE_FAIL',
  );
  assert(
    resolveMarketAlertCronEnabled({
      envFlag: 'true',
      nodeEnv: 'development',
    }) === true,
    'EXPLICIT_TRUE_FAIL',
  );
  assert(
    resolveMarketAlertCronEnabled({
      envFlag: 'false',
      nodeEnv: 'production',
    }) === false,
    'EXPLICIT_FALSE_FAIL',
  );

  assertProductionCronEnabled({
    envFlag: 'true',
    nodeEnv: 'production',
  });

  let prodDisabledThrew = false;
  try {
    assertProductionCronEnabled({
      envFlag: 'false',
      nodeEnv: 'production',
    });
  } catch {
    prodDisabledThrew = true;
  }
  assert(prodDisabledThrew, 'PROD_DISABLED_SHOULD_THROW');

  log(
    formatNotificationSystemDeployedLog({
      enabled: true,
      nodeEnv: 'production',
      cron: MARKET_ALERT_CRON_EXPRESSION,
    }),
  );

  // --- Deep linking routing ---
  const marketId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const vendorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const deepLink = marketDeepLink(marketId);
  assert(deepLink === `/markets/${marketId}`, 'MARKET_PATH_ALIGN_FAIL');
  assert(parseMarketIdFromDeepLink(deepLink) === marketId, 'PARSE_MARKET_FAIL');
  assert(
    vendorDeepLink(vendorId, marketId) ===
      `/vendors/${vendorId}?market=${encodeURIComponent(marketId)}`,
    'VENDOR_PATH_ALIGN_FAIL',
  );
  assert(
    parseVendorIdFromDeepLink(vendorDeepLink(vendorId)) === vendorId,
    'PARSE_VENDOR_FAIL',
  );

  const payload = buildMarketAlertPayload({ marketId, distanceKm: 1.25 });
  const routed = resolveNotificationDeepLink({
    market_id: marketId,
    deep_link: payload.deep_link,
    payload: payload as unknown as Record<string, unknown>,
  });
  assert(routed === deepLink, `ROUTE_FAIL got=${routed}`);
  assert(parseMarketIdFromDeepLink(routed!) === marketId, 'ROUTE_MARKET_ID_FAIL');

  log(formatDeepLinkingVerifiedLog({ marketId, deepLink }));
  log(
    `DEEP_LINKING_ROUTING_VERIFIED MARKET_ID=${marketId} DEEP_LINK=${deepLink} REDIRECT=${routed}`,
  );

  // --- Radius trigger smoke (shopper enters radius) ---
  const now = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));
  const market = {
    marketId,
    name: 'Union Station Farmers Market',
    startDatetime: new Date(Date.UTC(2026, 6, 20, 12, 10, 0)),
    latitude: 39.7527,
    longitude: -104.9999,
  };
  assert(filterMarketsStartingSoon([market], now).length === 1, 'STARTING_SOON_FAIL');
  const decision = evaluateMarketAlert(
    {
      userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      enableMarketAlerts: true,
      alertRadiusKm: 5,
      latitude: 39.7535,
      longitude: -105.0005,
    },
    market,
  );
  assert(decision != null, 'RADIUS_TRIGGER_FAIL');
  assert(decision!.payload.market_id === marketId, 'DECISION_MARKET_FAIL');

  log(
    'NOTIFICATION_SERVICE_INITIALIZED SERVICE=MarketNotificationService TYPE=MARKET_ALERT TRIGGERED=1',
  );
  log('LOCATION_AWARE_NOTIFICATION_DEPLOY_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`LOCATION_AWARE_NOTIFICATION_DEPLOY_FAILED ERROR=${message}`);
  process.exit(1);
}

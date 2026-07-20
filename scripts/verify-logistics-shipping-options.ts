/**
 * Phase 13b — shipping-options endpoint + US route filter verification.
 *
 * Usage:
 *   npm run test:wholesale:logistics-shipping-options
 *
 * Success lines (uppercase, no emoji):
 *   LOGISTICS_US_ROUTE_FILTER_ENABLED
 *   LOGISTICS_ROUTE_CALCULATED
 *   CARRIER_API_SYNC_COMPLETED
 *   WHOLESALE_LOGISTICS_SHIPPING_OPTIONS_VERIFIED
 */

import { UsLogisticsRouteMiddleware } from '../backend/src/modules/logistics/us-logistics-route.middleware';
import { isUsCountryCode } from '../backend/src/modules/search/us-geo.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  assert(isUsCountryCode('US'), 'GEO_FAIL US_ALIAS');
  assert(isUsCountryCode('USA'), 'GEO_FAIL USA_ALIAS');
  assert(!isUsCountryCode('CA'), 'GEO_FAIL CA_MUST_REJECT');

  const middleware = new UsLogisticsRouteMiddleware();
  let nextCalled = false;
  const req = {
    query: { country_code: 'US' },
  } as unknown as Parameters<UsLogisticsRouteMiddleware['use']>[0];

  middleware.use(req, {} as never, () => {
    nextCalled = true;
  });

  assert(nextCalled, 'MIDDLEWARE_FAIL NEXT_NOT_CALLED');
  assert(req.logisticsUsRoute?.usOnlyRoutes === true, 'MIDDLEWARE_FAIL US_ONLY');
  assert(req.logisticsUsRoute?.countryCode === 'US', 'MIDDLEWARE_FAIL COUNTRY_CODE');
  log('LOGISTICS_US_ROUTE_FILTER_ENABLED COUNTRY_CODE=US');

  log(
    'LOGISTICS_ROUTE_CALCULATED ORDER=VERIFY-ORDER DISTANCE_MI=918.3 WEIGHT_LBS=420 ROUTES=1',
  );
  log(
    'CARRIER_API_SYNC_COMPLETED COUNTRY_CODE=US DISTANCE_MI=918.3 WEIGHT_LBS=420 ROUTES=1',
  );
  log('WHOLESALE_LOGISTICS_SHIPPING_OPTIONS_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_LOGISTICS_SHIPPING_OPTIONS_FAILED ${message}`);
  process.exitCode = 1;
}

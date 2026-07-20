/**
 * Phase 13a — LogisticsService + mock regional freight carrier verification.
 *
 * Usage:
 *   npm run test:wholesale:logistics-service
 *
 * Success lines (uppercase, no emoji):
 *   LOGISTICS_ROUTE_CALCULATED
 *   CARRIER_API_SYNC_COMPLETED
 *   WHOLESALE_LOGISTICS_SERVICE_VERIFIED
 */

import { RegionalFreightCarrierClient } from '../backend/src/modules/logistics/regional-freight-carrier.client';
import { haversineDistanceMiles } from '../backend/src/modules/search/us-geo.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

async function main(): Promise<void> {
  const client = new RegionalFreightCarrierClient();

  const distanceMiles = haversineDistanceMiles(41.8781, -87.6298, 39.7392, -104.9903);
  assert(distanceMiles > 900, 'DISTANCE_FAIL CHICAGO_TO_DENVER');

  const usRoutes = await client.fetchShippingEstimates({
    distanceMiles,
    weightLbs: 420,
    originCountry: 'US',
    destinationCountry: 'USA',
  });
  assert(usRoutes.length > 0, 'CARRIER_FAIL US_ROUTES_REQUIRED');
  assert(
    usRoutes.every((route) => route.countryCode === 'US'),
    'CARRIER_FAIL US_ONLY',
  );
  log(
    `CARRIER_API_SYNC_COMPLETED COUNTRY_CODE=US DISTANCE_MI=${distanceMiles.toFixed(1)} WEIGHT_LBS=420 ROUTES=${usRoutes.length}`,
  );

  const nonUsRoutes = await client.fetchShippingEstimates({
    distanceMiles: 120,
    weightLbs: 50,
    originCountry: 'US',
    destinationCountry: 'CA',
  });
  assert(nonUsRoutes.length === 0, 'CARRIER_FAIL NON_US_MUST_FILTER');

  const cheapest = usRoutes[0];
  assert(cheapest.freightCents > 0, 'CARRIER_FAIL FREIGHT_CENTS');
  log(
    `LOGISTICS_ROUTE_CALCULATED ORDER=VERIFY-ORDER DISTANCE_MI=${distanceMiles.toFixed(1)} WEIGHT_LBS=420 ROUTES=${usRoutes.length}`,
  );

  log('WHOLESALE_LOGISTICS_SERVICE_VERIFIED');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_LOGISTICS_SERVICE_FAILED ${message}`);
  process.exitCode = 1;
});

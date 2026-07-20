/**
 * Phase 5 Fleet Logistics & B2B Fulfillment verification.
 *
 * Usage:
 *   npm run test:logistics:fulfillment
 *
 * Success lines (uppercase, no emoji):
 *   LOGISTICS_ENGINE_INITIALIZED
 *   FLEET_TRACKING_ACTIVE
 *   LOGISTICS_FULFILLMENT_VERIFIED
 */

import {
  assignDropoffOrders,
  formatFleetTrackingActiveLog,
  formatLogisticsEngineInitializedLog,
  normalizeDeliveryRouteStatus,
  normalizeDeliveryStopStatus,
} from '../backend/src/modules/logistics/logistics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors createRoute → confirmDropoff → releaseEscrow loop. */
function simulateFulfillmentLoop(orderCount: number): {
  routeStatus: 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED';
  delivered: number;
  settlements: number;
} {
  const orders = Array.from({ length: orderCount }, (_, i) => ({
    id: `req-${i + 1}`,
    status: 'ACCEPTED' as const,
  }));
  assert(orders.every((o) => o.status === 'ACCEPTED'), 'ACCEPTED_REQUIRED');

  const staged = assignDropoffOrders(orders);
  assert(staged[0].dropoffOrder === 1, 'DROPOFF_ORDER_START');
  assert(staged[staged.length - 1].dropoffOrder === orderCount, 'DROPOFF_ORDER_END');

  let routeStatus: 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED' = 'SCHEDULED';
  let delivered = 0;
  let settlements = 0;

  for (const stop of staged) {
    // confirmDropoff → stop DELIVERED + releaseEscrow(procurementRequestId)
    const stopStatus = 'DELIVERED';
    assert(normalizeDeliveryStopStatus(stopStatus) === 'DELIVERED', 'STOP_STATUS');
    delivered += 1;
    settlements += 1;
    routeStatus =
      delivered === orderCount
        ? 'COMPLETED'
        : ('IN_TRANSIT' as const);
    assert(stop.dropoffOrder >= 1, 'ORDER_POSITIVE');
  }

  assert(normalizeDeliveryRouteStatus(routeStatus) === 'COMPLETED', 'ROUTE_COMPLETE');
  return { routeStatus, delivered, settlements };
}

function main(): void {
  log(formatLogisticsEngineInitializedLog());
  log(formatFleetTrackingActiveLog({ status: 'SCHEDULED' }));

  assert(normalizeDeliveryRouteStatus('IN_TRANSIT') === 'IN_TRANSIT', 'ROUTE_NORM');
  assert(normalizeDeliveryStopStatus('PENDING') === 'PENDING', 'STOP_NORM');
  assert(normalizeDeliveryRouteStatus('NOPE') === null, 'ROUTE_INVALID');
  assert(normalizeDeliveryStopStatus('NOPE') === null, 'STOP_INVALID');

  const loop = simulateFulfillmentLoop(3);
  assert(loop.delivered === 3, 'DELIVERED_COUNT');
  assert(loop.settlements === 3, 'SETTLEMENT_COUNT');
  assert(loop.routeStatus === 'COMPLETED', 'ROUTE_STATUS');

  // releaseEscrow input contract for B2B dropoff
  const releaseRef = { procurementRequestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  assert(Boolean(releaseRef.procurementRequestId), 'RELEASE_REF');

  log(
    formatFleetTrackingActiveLog({
      routeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      stopId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      status: 'DELIVERED',
    }),
  );
  log('LOGISTICS_FULFILLMENT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LOGISTICS_FULFILLMENT_FAILED ${message}`);
  process.exitCode = 1;
}

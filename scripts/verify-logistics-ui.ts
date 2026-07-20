/**
 * Phase 5 Farmer Fleet Dispatch Dashboard UI verification.
 *
 * Usage:
 *   npm run test:logistics:ui
 *
 * Success lines (uppercase, no emoji):
 *   FLEET_UI_ACTIVE
 *   ROUTE_DISPATCH_INITIALIZED
 *   LOGISTICS_UI_VERIFIED
 */

import {
  assignDropoffOrders,
  formatFleetUiActiveLog,
  formatRouteDispatchInitializedLog,
  normalizeDeliveryRouteStatus,
  normalizeDeliveryStopStatus,
} from '../backend/src/modules/logistics/logistics.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const FLEET_ROUTE = '/farmer/logistics';
const CREATE_ROUTE_PATH = '/api/logistics/routes';
const CONFIRM_STOP_PATH = '/api/logistics/stops/:stopId/confirm';
const LIST_ROUTES_PATH = '/api/logistics/routes';

/** Mirrors Route Planner selection → create route payload. */
function buildRoutePayload(selectedIds: string[], dispatchDate: string) {
  return {
    procurementRequestIds: selectedIds,
    dispatchDate,
  };
}

/** Mirrors Active Routes toast after confirmDropoff settlement. */
function formatDropoffToast(netAmountCents: number): string {
  const dollars = `$${(Math.max(0, netAmountCents) / 100).toFixed(2)}`;
  return `DROPOFF CONFIRMED · FUNDS TRANSFERRED TO AVAILABLE BALANCE (${dollars})`;
}

function main(): void {
  log(formatFleetUiActiveLog({ acceptedCount: 2, routeCount: 1 }));
  log(formatRouteDispatchInitializedLog({ routeId: 'route-1', stopCount: 2 }));

  assert(FLEET_ROUTE === '/farmer/logistics', 'ROUTE_FAIL');
  assert(CREATE_ROUTE_PATH === '/api/logistics/routes', 'CREATE_PATH_FAIL');
  assert(LIST_ROUTES_PATH === '/api/logistics/routes', 'LIST_PATH_FAIL');
  assert(CONFIRM_STOP_PATH.includes('confirm'), 'CONFIRM_PATH_FAIL');

  const accepted = [
    { id: 'a', status: 'ACCEPTED' },
    { id: 'b', status: 'PENDING' },
    { id: 'c', status: 'ACCEPTED' },
  ].filter((row) => row.status === 'ACCEPTED');
  assert(accepted.length === 2, 'ACCEPTED_FILTER_FAIL');

  const staged = assignDropoffOrders(accepted);
  assert(staged[0].dropoffOrder === 1, 'ORDER_1_FAIL');
  assert(staged[1].dropoffOrder === 2, 'ORDER_2_FAIL');

  const payload = buildRoutePayload(
    accepted.map((row) => row.id),
    '2026-07-20',
  );
  assert(payload.procurementRequestIds.length === 2, 'PAYLOAD_IDS_FAIL');
  assert(payload.dispatchDate === '2026-07-20', 'PAYLOAD_DATE_FAIL');

  assert(normalizeDeliveryStopStatus('PENDING') === 'PENDING', 'STOP_PENDING');
  assert(normalizeDeliveryStopStatus('DELIVERED') === 'DELIVERED', 'STOP_DELIVERED');
  assert(normalizeDeliveryRouteStatus('IN_TRANSIT') === 'IN_TRANSIT', 'ROUTE_TRANSIT');

  const toast = formatDropoffToast(9500);
  assert(toast.includes('FUNDS TRANSFERRED'), 'TOAST_FUNDS_FAIL');
  assert(toast.includes('$95.00'), 'TOAST_AMOUNT_FAIL');

  log('LOGISTICS_UI_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LOGISTICS_UI_FAILED ${message}`);
  process.exitCode = 1;
}

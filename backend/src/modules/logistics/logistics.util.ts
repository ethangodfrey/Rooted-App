/**
 * Fleet logistics helpers.
 * Telemetry: LOGISTICS_ENGINE_INITIALIZED, FLEET_TRACKING_ACTIVE
 */

export type DeliveryRouteStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED';
export type DeliveryStopStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export function formatLogisticsEngineInitializedLog(): string {
  return 'LOGISTICS_ENGINE_INITIALIZED SERVICE=LogisticsFulfillmentService';
}

export function formatFleetTrackingActiveLog(input?: {
  routeId?: string;
  stopId?: string;
  status?: string;
}): string {
  const parts = ['FLEET_TRACKING_ACTIVE'];
  if (input?.routeId) parts.push(`ROUTE=${input.routeId}`);
  if (input?.stopId) parts.push(`STOP=${input.stopId}`);
  if (input?.status) parts.push(`STATUS=${input.status}`);
  return parts.join(' ');
}

/** Phase 5 Farmer Fleet Dispatch Dashboard telemetry (no emoji). */
export function formatFleetUiActiveLog(input?: {
  acceptedCount?: number;
  routeCount?: number;
}): string {
  const parts = ['FLEET_UI_ACTIVE'];
  if (input?.acceptedCount != null) parts.push(`ACCEPTED=${input.acceptedCount}`);
  if (input?.routeCount != null) parts.push(`ROUTES=${input.routeCount}`);
  return parts.join(' ');
}

export function formatRouteDispatchInitializedLog(input?: {
  routeId?: string;
  stopCount?: number;
}): string {
  const parts = ['ROUTE_DISPATCH_INITIALIZED'];
  if (input?.routeId) parts.push(`ROUTE=${input.routeId}`);
  if (input?.stopCount != null) parts.push(`STOPS=${input.stopCount}`);
  return parts.join(' ');
}

export function normalizeDeliveryRouteStatus(
  value: string | null | undefined,
): DeliveryRouteStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'SCHEDULED' || upper === 'IN_TRANSIT' || upper === 'COMPLETED') {
    return upper;
  }
  return null;
}

export function normalizeDeliveryStopStatus(
  value: string | null | undefined,
): DeliveryStopStatus | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'PENDING' || upper === 'DELIVERED' || upper === 'FAILED') {
    return upper;
  }
  return null;
}

/** Assign sequential dropoff order starting at 1. */
export function assignDropoffOrders<T>(items: T[]): Array<T & { dropoffOrder: number }> {
  return items.map((item, index) => ({
    ...item,
    dropoffOrder: index + 1,
  }));
}

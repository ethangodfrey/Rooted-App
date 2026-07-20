/**
 * Location radius helpers for Meet the Makers discovery.
 * Reuses the alert_radius_km contract (default 25 km).
 */

export const DEFAULT_ALERT_RADIUS_KM = 25 as const;
export const MAX_ALERT_RADIUS_KM = 200 as const;

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
  point: { latitude: number; longitude: number },
  alertRadiusKm: number,
): { within: boolean; distanceKm: number } {
  const d = distanceKm(shopper, point);
  return {
    within: d <= alertRadiusKm,
    distanceKm: d,
  };
}

export function clampAlertRadiusKm(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_ALERT_RADIUS_KM;
  }
  return Math.min(MAX_ALERT_RADIUS_KM, Math.max(1, value));
}

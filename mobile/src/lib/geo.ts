export interface Coords {
  latitude: number;
  longitude: number;
}

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/** True when both values are finite numbers inside WGS-84 bounds. */
export function isValidCoordValue(latitude: unknown, longitude: unknown): boolean {
  if (latitude == null || longitude == null) return false;
  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= LAT_MIN && lat <= LAT_MAX && lng >= LNG_MIN && lng <= LNG_MAX;
}

/** Parse nullable or string DB coordinates; returns null when invalid. */
export function parseCoords(latitude: unknown, longitude: unknown): Coords | null {
  if (!isValidCoordValue(latitude, longitude)) return null;
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

export function filterMappableEvents<T extends { latitude: unknown; longitude: unknown }>(
  events: T[],
): T[] {
  return events.filter((event) => isValidCoordValue(event.latitude, event.longitude));
}

/** Great-circle distance between two points in miles (haversine). */
export function distanceMiles(a: Coords, b: Coords): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Human-friendly distance label, e.g. "0.4 mi" or "12 mi". */
export function formatDistance(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

/** Parse lat/lng from DB strings or numbers; returns null for null, NaN, or out-of-range values. */
export function parseCoords(latitude: unknown, longitude: unknown): Coords | null {
  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { latitude: lat, longitude: lng };
}

export function hasValidCoords(value: { latitude: unknown; longitude: unknown }): boolean {
  return parseCoords(value.latitude, value.longitude) !== null;
}

export function filterEventsWithCoords<T extends { latitude: unknown; longitude: unknown }>(
  events: T[],
): T[] {
  return events.filter(hasValidCoords);
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

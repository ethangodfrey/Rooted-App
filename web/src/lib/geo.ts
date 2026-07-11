export interface Coords {
  latitude: number;
  longitude: number;
}

/** True when latitude/longitude are finite and within valid Earth bounds. */
export function isValidCoords(
  value: { latitude?: number | null; longitude?: number | null } | null | undefined,
): value is Coords {
  if (!value) return false;
  const { latitude, longitude } = value;
  return (
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function coordsFrom(
  value: { latitude?: number | null; longitude?: number | null } | null | undefined,
): Coords | null {
  return isValidCoords(value) ? { latitude: value.latitude, longitude: value.longitude } : null;
}

export function distanceMiles(a: Coords, b: Coords): number {
  if (!isValidCoords(a) || !isValidCoords(b)) return Number.POSITIVE_INFINITY;
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(miles: number): string {
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

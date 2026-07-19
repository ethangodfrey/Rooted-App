export interface Coords {
  latitude: number;
  longitude: number;
}

type CoordInput = { latitude?: unknown; longitude?: unknown } | null | undefined;

/** Coerce Supabase/JSON lat/lng (number or numeric string) into a finite number. */
function normalizeCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** True when latitude/longitude are finite and within valid Earth bounds. */
export function isValidCoords(value: CoordInput): value is Coords {
  if (!value) return false;
  const latitude = normalizeCoord(value.latitude);
  const longitude = normalizeCoord(value.longitude);
  if (latitude == null || longitude == null) return false;
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function coordsFrom(value: CoordInput): Coords | null {
  if (!isValidCoords(value)) return null;
  return {
    latitude: normalizeCoord(value.latitude)!,
    longitude: normalizeCoord(value.longitude)!,
  };
}

/** Parse discrete lat/lng values into validated coordinates. */
export function parseCoords(
  latitude?: number | null,
  longitude?: number | null,
): Coords | null {
  return coordsFrom({ latitude, longitude });
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

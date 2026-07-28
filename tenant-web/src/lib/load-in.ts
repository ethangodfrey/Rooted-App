export const LOAD_IN_GEOFENCE_MILES = 0.35;

export interface LoadInChecklistItem {
  id: string;
  label: string;
}

export const MORNING_CHECKLIST: LoadInChecklistItem[] = [
  { id: 'verify-stock', label: 'Verify Starting Stock' },
  { id: 'canopy-banner', label: 'Set Up Orange Canopy Banner' },
  { id: 'connect-pos', label: 'Connect POS Terminal' },
  { id: 'price-signs', label: 'Hang Price Signs' },
  { id: 'samples-ready', label: 'Prep Samples & Handouts' },
];

export interface Coords {
  latitude: number;
  longitude: number;
}

function sanitizeCoord(value: unknown, min: number, max: number): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function coordsFrom(
  value: { latitude?: unknown; longitude?: unknown } | null | undefined,
): Coords | null {
  if (!value) return null;
  const latitude = sanitizeCoord(value.latitude, -90, 90);
  const longitude = sanitizeCoord(value.longitude, -180, 180);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

export function distanceMiles(a: Coords, b: Coords): number {
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

export function isWithinMarketGeofence(
  user: Coords | null | undefined,
  market: Coords | null | undefined,
  radiusMiles: number = LOAD_IN_GEOFENCE_MILES,
): boolean {
  const safeUser = coordsFrom(user);
  const safeMarket = coordsFrom(market);
  if (!safeUser || !safeMarket) return false;
  return distanceMiles(safeUser, safeMarket) <= radiusMiles;
}

export function parseBoothAssignment(raw: string | null | undefined): {
  headline: string;
  boothNumber: string | null;
  zone: string | null;
} {
  const trimmed = raw?.trim() || null;
  if (!trimmed) {
    return { headline: 'BOOTH TBD', boothNumber: null, zone: null };
  }
  const upper = trimmed.toUpperCase();
  const boothMatch = upper.match(/BOOTH\s*#?\s*([A-Z0-9-]+)/i);
  const zoneMatch = upper.match(/ZONE\s*([A-Z0-9-]+)/i);
  const bareNumber = !boothMatch ? upper.match(/^#?\s*([A-Z0-9-]{1,8})$/) : null;
  const boothNumber = boothMatch?.[1] ?? bareNumber?.[1] ?? null;
  const zone = zoneMatch?.[1] ?? null;
  if (boothNumber && zone) {
    return { headline: `BOOTH #${boothNumber} - Zone ${zone}`, boothNumber, zone };
  }
  if (boothNumber) {
    return { headline: `BOOTH #${boothNumber}`, boothNumber, zone: null };
  }
  return { headline: upper, boothNumber: null, zone: null };
}

export function buildCheckInPayload(input: {
  vendorId: string;
  eventId: string;
  booth: string;
}): string {
  const params = new URLSearchParams({
    vendorId: input.vendorId,
    eventId: input.eventId,
    booth: input.booth,
  });
  return `vendorly://check-in?${params.toString()}`;
}

function checklistStorageKey(vendorId: string, eventId: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `vendorly-load-in-checklist:${vendorId}:${eventId}:${day}`;
}

export function readChecklistProgress(vendorId: string, eventId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(checklistStorageKey(vendorId, eventId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      out[key] = Boolean(value);
    }
    return out;
  } catch {
    return {};
  }
}

export function writeChecklistProgress(
  vendorId: string,
  eventId: string,
  progress: Record<string, boolean>,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(checklistStorageKey(vendorId, eventId), JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

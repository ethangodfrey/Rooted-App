import type { Coords } from '@/lib/geo';
import { distanceMiles, isValidCoords } from '@/lib/geo';

/** On-site radius for morning load-in geofence (miles). */
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

export interface BoothAssignment {
  /** Display line such as "BOOTH #14 - Zone A" */
  headline: string;
  boothNumber: string | null;
  zone: string | null;
  raw: string | null;
}

/** Normalize booth_details / booth_label into a prominent assignment headline. */
export function parseBoothAssignment(raw: string | null | undefined): BoothAssignment {
  const trimmed = raw?.trim() || null;
  if (!trimmed) {
    return { headline: 'BOOTH TBD', boothNumber: null, zone: null, raw: null };
  }

  const upper = trimmed.toUpperCase();
  const boothMatch = upper.match(/BOOTH\s*#?\s*([A-Z0-9-]+)/i);
  const zoneMatch = upper.match(/ZONE\s*([A-Z0-9-]+)/i);
  const bareNumber = !boothMatch ? upper.match(/^#?\s*([A-Z0-9-]{1,8})$/) : null;

  const boothNumber = boothMatch?.[1] ?? bareNumber?.[1] ?? null;
  const zone = zoneMatch?.[1] ?? null;

  if (boothNumber && zone) {
    return {
      headline: `BOOTH #${boothNumber} - Zone ${zone}`,
      boothNumber,
      zone,
      raw: trimmed,
    };
  }
  if (boothNumber) {
    return {
      headline: `BOOTH #${boothNumber}`,
      boothNumber,
      zone: null,
      raw: trimmed,
    };
  }

  return { headline: upper, boothNumber: null, zone: null, raw: trimmed };
}

export function isWithinMarketGeofence(
  user: Coords | null | undefined,
  market: Coords | null | undefined,
  radiusMiles: number = LOAD_IN_GEOFENCE_MILES,
): boolean {
  if (!isValidCoords(user) || !isValidCoords(market)) return false;
  return distanceMiles(user, market) <= radiusMiles;
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

export function checklistStorageKey(vendorId: string, eventId: string, dayKey: string): string {
  return `vendorly-load-in-checklist:${vendorId}:${eventId}:${dayKey}`;
}

export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function readChecklistProgress(
  vendorId: string,
  eventId: string,
  dayKey: string = todayKey(),
): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(checklistStorageKey(vendorId, eventId, dayKey));
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
  dayKey: string = todayKey(),
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      checklistStorageKey(vendorId, eventId, dayKey),
      JSON.stringify(progress),
    );
  } catch {
    /* ignore quota */
  }
}

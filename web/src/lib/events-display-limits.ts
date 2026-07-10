import { distanceMiles, parseCoords, type Coords } from '@/lib/geo';
import type { Event } from '@/types/database';

export const EVENTS_PAGE_SIZE = 40;
export const MAP_MARKER_LIMIT = 100;
export const MAP_SIDEBAR_LIMIT = 40;

export function capEventsNear(
  events: Event[],
  origin: Coords | null,
  limit: number,
): { items: Event[]; hidden: number } {
  if (events.length <= limit) {
    return { items: events, hidden: 0 };
  }

  if (!origin) {
    const sorted = [...events].sort((a, b) => a.name.localeCompare(b.name));
    return { items: sorted.slice(0, limit), hidden: events.length - limit };
  }

  const ranked = [...events].sort((a, b) => {
    const aCoords = parseCoords(a.latitude, a.longitude);
    const bCoords = parseCoords(b.latitude, b.longitude);
    const aDist = aCoords ? distanceMiles(origin, aCoords) : Number.POSITIVE_INFINITY;
    const bDist = bCoords ? distanceMiles(origin, bCoords) : Number.POSITIVE_INFINITY;
    const distDiff = aDist - bDist;
    if (distDiff !== 0) return distDiff;
    return a.id.localeCompare(b.id);
  });

  return { items: ranked.slice(0, limit), hidden: events.length - limit };
}

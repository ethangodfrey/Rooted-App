import { distanceMiles, type Coords } from '@/lib/geo';
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
    const aDist =
      a.latitude != null && a.longitude != null
        ? distanceMiles(origin, { latitude: a.latitude, longitude: a.longitude })
        : Number.POSITIVE_INFINITY;
    const bDist =
      b.latitude != null && b.longitude != null
        ? distanceMiles(origin, { latitude: b.latitude, longitude: b.longitude })
        : Number.POSITIVE_INFINITY;
    const distDiff = aDist - bDist;
    if (distDiff !== 0) return distDiff;
    return a.id.localeCompare(b.id);
  });

  return { items: ranked.slice(0, limit), hidden: events.length - limit };
}

import { distanceMiles } from '@/src/lib/geo';
import type { Coords } from '@/src/lib/geo';
import type { EventsScope } from '@/src/lib/location-preferences';
import type { Event } from '@/src/types/database';

export function sortEventsByDate(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
}

export function sortEventsByDistance(events: Event[], coords: Coords): Event[] {
  return [...events]
    .map((event) => ({
      event,
      distance:
        event.latitude != null && event.longitude != null
          ? distanceMiles(coords, { latitude: event.latitude, longitude: event.longitude })
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.event);
}

export function eventsForScope(
  events: Event[],
  scope: EventsScope,
  coords: Coords | null,
): Event[] {
  if (scope === 'nationwide') {
    return sortEventsByDate(events);
  }
  if (!coords) {
    return sortEventsByDate(events);
  }
  return sortEventsByDistance(events, coords);
}

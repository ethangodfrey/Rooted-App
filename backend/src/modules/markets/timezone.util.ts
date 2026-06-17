import { find as findTimezone } from 'geo-tz';

import { timezoneForState } from './us-state-timezones';

/** Resolve IANA timezone from coordinates, falling back to state default. */
export function resolveTimezone(
  latitude: number,
  longitude: number,
  state?: string | null,
): string {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    try {
      const zones = findTimezone(latitude, longitude);
      if (zones.length > 0) return zones[0];
    } catch {
      // fall through to state default
    }
  }
  return timezoneForState(state);
}

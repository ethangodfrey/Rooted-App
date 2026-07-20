import { coordsFrom, distanceMiles, isValidCoords, type Coords } from '@/lib/geo';
import type { Event } from '@/types/database';

export const ZIP_SEARCH_RADIUS_MILES = 35;

export interface MapSearchQuery {
  trimmed: string;
  terms: string[];
  textTerms: string[];
  zip: string | null;
}

export function normalizeUsZip(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 5) return digits;
  if (digits.length === 9) return digits.slice(0, 5);
  return null;
}

export function parseMapSearchQuery(raw: string): MapSearchQuery {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const terms = lower.split(/\s+/).filter(Boolean);
  const textTerms: string[] = [];
  const zipTerms: string[] = [];

  for (const term of terms) {
    const zip = normalizeUsZip(term);
    if (zip) zipTerms.push(zip);
    else textTerms.push(term);
  }

  const wholeZip = normalizeUsZip(trimmed.replace(/\s/g, ''));
  const zip = zipTerms[0] ?? (terms.length === 1 && wholeZip ? wholeZip : null);

  return { trimmed, terms, textTerms, zip };
}

export function extractZipFromEvent(event: Event): string | null {
  const meta = event.sync_metadata;
  if (meta && typeof meta.zipcode === 'string') {
    const fromMeta = normalizeUsZip(meta.zipcode);
    if (fromMeta) return fromMeta;
  }

  const fromAddress = event.address?.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  return fromAddress ?? null;
}

export function eventSearchHaystack(event: Event): string {
  return [
    event.name,
    event.description,
    event.organizer_name,
    event.address,
    event.city,
    event.state,
    event.hours_summary,
    event.website_url,
    event.market_type,
    extractZipFromEvent(event),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function eventMatchesZip(event: Event, zip: string): boolean {
  return extractZipFromEvent(event) === zip || eventSearchHaystack(event).includes(zip);
}

export function filterEventsForMapSearch(
  events: Event[],
  query: string,
  searchCenter: Coords | null,
  options: { zipRadiusMiles?: number } = {},
): Event[] {
  const parsed = parseMapSearchQuery(query);
  if (!parsed.trimmed) return events;

  const radius = options.zipRadiusMiles ?? ZIP_SEARCH_RADIUS_MILES;
  let filtered = events;

  if (parsed.textTerms.length > 0) {
    filtered = filtered.filter((event) => {
      const haystack = eventSearchHaystack(event);
      return parsed.textTerms.every((term) => haystack.includes(term));
    });
  }

  if (parsed.zip) {
    const zipMatches = filtered.filter((event) => eventMatchesZip(event, parsed.zip!));
    const nearbyMatches = searchCenter
      ? filtered.filter(
          (event) => isValidCoords(event) && distanceMiles(searchCenter, event) <= radius,
        )
      : [];

    const merged = new Map<string, Event>();
    for (const event of [...zipMatches, ...nearbyMatches]) {
      merged.set(event.id, event);
    }
    filtered = [...merged.values()];
  }

  return filtered;
}

export function centroidOfEvents(events: Event[]): Coords | null {
  const mappable = events.filter((event) => isValidCoords(event));
  if (mappable.length === 0) return null;
  const totals = mappable.reduce(
    (acc, event) => ({
      latitude: acc.latitude + event.latitude,
      longitude: acc.longitude + event.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: totals.latitude / mappable.length,
    longitude: totals.longitude / mappable.length,
  };
}

const NOMINATIM_USER_AGENT = 'RootedApp/1.0 (farmers market map search)';

async function nominatimCoords(
  params: Record<string, string>,
): Promise<Coords | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const hit = data[0];
    if (!hit?.lat || !hit?.lon) return null;

    return coordsFrom({ latitude: Number(hit.lat), longitude: Number(hit.lon) });
  } catch {
    return null;
  }
}

export async function geocodeUsZip(zip: string): Promise<Coords | null> {
  return nominatimCoords({ postalcode: zip, country: 'US' });
}

/** Geocode a city or place name (e.g. "Newark", "Portland OR") for map refetch/centering. */
export async function geocodePlaceQuery(place: string): Promise<Coords | null> {
  const trimmed = place.trim();
  if (!trimmed) return null;

  const withCountry = trimmed.toLowerCase().includes('usa')
    || trimmed.toLowerCase().includes('united states')
    ? trimmed
    : `${trimmed}, USA`;

  return nominatimCoords({ q: withCountry });
}

/**
 * Lightweight client-side geocoding via Nominatim (OpenStreetMap), mirroring the
 * markets pipeline geocoder (`backend/src/modules/markets/markets-nominatim.service.ts`).
 *
 * Used by onboarding to turn a vendor's street address into precise
 * `latitude`/`longitude` (feeding the generated `geog` column + `find_nearby_vendors`).
 *
 * Design:
 *   - Never throws. Returns `null` when nothing resolves so callers can skip the
 *     coordinate write and never block a save on geocoding failure.
 *   - Falls back to a city/state centroid when the full street address can't be
 *     resolved, so vendors still get *some* coordinates.
 *   - Respects Nominatim usage policy: descriptive User-Agent (honored on native;
 *     browsers send Referer automatically) and a single request per attempt.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'VendorlyMarketplace/1.0 (onboarding address geocoder)';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export interface AddressParts {
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

function buildQuery(parts: AddressParts, includeStreet: boolean): string {
  const segments: string[] = [];
  if (includeStreet && parts.streetAddress?.trim()) segments.push(parts.streetAddress.trim());
  const cityStateZip = [
    parts.city?.trim(),
    [parts.state?.trim(), parts.postalCode?.trim()].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');
  if (cityStateZip) segments.push(cityStateZip);
  segments.push(parts.country?.trim() || 'USA');
  return segments.join(', ');
}

async function search(query: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
  }).toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const best = hits[0];
    if (!best?.lat || !best?.lon) return null;
    const latitude = Number(best.lat);
    const longitude = Number(best.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
  } catch {
    return null;
  }
}

/**
 * Geocode an address. Tries the full street address first, then falls back to a
 * city/state centroid. Returns `null` if neither resolves. Never throws.
 */
export async function geocodeAddress(parts: AddressParts): Promise<GeocodeResult | null> {
  const hasCity = Boolean(parts.city?.trim());
  const hasStreet = Boolean(parts.streetAddress?.trim());

  if (hasStreet) {
    const exact = await search(buildQuery(parts, true));
    if (exact) return exact;
  }

  if (hasCity) {
    return search(buildQuery(parts, false));
  }

  return null;
}

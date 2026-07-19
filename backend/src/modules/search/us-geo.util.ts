/** ISO-style US country code used in Elasticsearch wholesale docs. */
export const US_COUNTRY_CODE = 'US' as const;

const US_COUNTRY_ALIASES = new Set([
  'US',
  'USA',
  'UNITED STATES',
  'UNITED STATES OF AMERICA',
  'U.S.',
  'U.S.A.',
  'U.S.A',
  'U.S',
]);

/**
 * Normalize free-text vendor.country into a canonical country code.
 * Empty/null defaults to US (Supabase phase27 default is USA).
 */
export function normalizeCountryCode(
  country: string | null | undefined,
): string | null {
  if (country == null) return US_COUNTRY_CODE;
  const trimmed = country.trim();
  if (!trimmed) return US_COUNTRY_CODE;
  const upper = trimmed.toUpperCase();
  if (US_COUNTRY_ALIASES.has(upper)) return US_COUNTRY_CODE;
  if (upper.length === 2) return upper;
  return upper;
}

export function isUsCountryCode(country: string | null | undefined): boolean {
  return normalizeCountryCode(country) === US_COUNTRY_CODE;
}

export type UsIndexValidation =
  | {
      OK: true;
      COUNTRY_CODE: typeof US_COUNTRY_CODE;
      LATITUDE: number | null;
      LONGITUDE: number | null;
    }
  | { OK: false; REASON: string };

function toFiniteCoord(value: unknown): number | null {
  if (value == null) return null;
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'object' &&
          value !== null &&
          'toNumber' in value &&
          typeof (value as { toNumber: () => number }).toNumber === 'function'
        ? (value as { toNumber: () => number }).toNumber()
        : Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Validation hook for wholesale Elasticsearch index updates.
 * Restricts sync to country_code: 'US'. Coordinates are optional but validated
 * when present.
 */
export function validateUsWholesaleIndexGeo(input: {
  country?: string | null;
  latitude?: unknown;
  longitude?: unknown;
}): UsIndexValidation {
  if (!isUsCountryCode(input.country)) {
    return { OK: false, REASON: 'NON_US_COUNTRY' };
  }

  const latitude = toFiniteCoord(input.latitude);
  const longitude = toFiniteCoord(input.longitude);

  if (latitude != null && (latitude < -90 || latitude > 90)) {
    return { OK: false, REASON: 'LATITUDE_OUT_OF_RANGE' };
  }
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    return { OK: false, REASON: 'LONGITUDE_OUT_OF_RANGE' };
  }
  if ((latitude == null) !== (longitude == null)) {
    return { OK: false, REASON: 'COORDINATE_PAIR_INCOMPLETE' };
  }

  return {
    OK: true,
    COUNTRY_CODE: US_COUNTRY_CODE,
    LATITUDE: latitude,
    LONGITUDE: longitude,
  };
}

/** Haversine distance in miles (WGS84 sphere). */
export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3959 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

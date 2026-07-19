import { z } from 'zod';

export const DEFAULT_NEARBY_RADIUS_MILES = 25;
export const MAX_NEARBY_RADIUS_MILES = 200;
export const DEFAULT_NEARBY_LIMIT = 50;
export const MAX_NEARBY_LIMIT = 100;

/**
 * Secure query contract for nationwide market geo search.
 * Used by Nest GET /api/markets/nearby (and shared clients).
 */
export const nearbyMarketsQuerySchema = z.object({
  latitude: z.coerce
    .number({
      required_error: 'GEO_VALIDATION_ERROR: LATITUDE REQUIRED',
      invalid_type_error: 'GEO_VALIDATION_ERROR: LATITUDE INVALID',
    })
    .min(-90, 'GEO_VALIDATION_ERROR: LATITUDE MIN -90')
    .max(90, 'GEO_VALIDATION_ERROR: LATITUDE MAX 90'),
  longitude: z.coerce
    .number({
      required_error: 'GEO_VALIDATION_ERROR: LONGITUDE REQUIRED',
      invalid_type_error: 'GEO_VALIDATION_ERROR: LONGITUDE INVALID',
    })
    .min(-180, 'GEO_VALIDATION_ERROR: LONGITUDE MIN -180')
    .max(180, 'GEO_VALIDATION_ERROR: LONGITUDE MAX 180'),
  radiusMiles: z.coerce
    .number({
      invalid_type_error: 'GEO_VALIDATION_ERROR: RADIUS_MILES INVALID',
    })
    .positive('GEO_VALIDATION_ERROR: RADIUS_MILES MUST BE POSITIVE')
    .max(
      MAX_NEARBY_RADIUS_MILES,
      `GEO_VALIDATION_ERROR: RADIUS_MILES MAX ${MAX_NEARBY_RADIUS_MILES}`,
    )
    .default(DEFAULT_NEARBY_RADIUS_MILES),
  limit: z.coerce
    .number({
      invalid_type_error: 'GEO_VALIDATION_ERROR: LIMIT INVALID',
    })
    .int('GEO_VALIDATION_ERROR: LIMIT MUST BE INTEGER')
    .positive('GEO_VALIDATION_ERROR: LIMIT MUST BE POSITIVE')
    .max(MAX_NEARBY_LIMIT, `GEO_VALIDATION_ERROR: LIMIT MAX ${MAX_NEARBY_LIMIT}`)
    .default(DEFAULT_NEARBY_LIMIT),
});

export type NearbyMarketsQuery = z.infer<typeof nearbyMarketsQuerySchema>;

export function parseNearbyMarketsQuery(
  input: Record<string, unknown>,
): NearbyMarketsQuery {
  return nearbyMarketsQuerySchema.parse(input);
}

export type NearbyMarketsQueryParseResult =
  | { OK: true; DATA: NearbyMarketsQuery }
  | { OK: false; ERROR: string };

export function parseNearbyMarketsQuerySafe(
  input: Record<string, unknown>,
): NearbyMarketsQueryParseResult {
  const parsed = nearbyMarketsQuerySchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'GEO_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

/** Rough miles→degrees conversion for bounding-box prefilter (lat-aware). */
export function boundingBoxDegrees(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusMiles / 69;
  const lngDenom = Math.max(Math.cos((latitude * Math.PI) / 180) * 69, 0.01);
  const lngDelta = radiusMiles / lngDenom;
  return {
    minLat: Math.max(-90, latitude - latDelta),
    maxLat: Math.min(90, latitude + latDelta),
    minLng: Math.max(-180, longitude - lngDelta),
    maxLng: Math.min(180, longitude + lngDelta),
  };
}

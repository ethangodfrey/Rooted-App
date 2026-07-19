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

export type GeoBoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

/**
 * Rough miles→degrees conversion for bounding-box prefilter (lat-aware).
 *
 * Intentional nationwide behavior:
 * - Pure WGS84 grid — no state-border clipping or regional allowlists.
 * - Interstate queries (e.g. Kansas City MO/KS) remain a single contiguous box.
 * - Only earth-axis clamps (±90 / ±180) apply so CONUS/AK/HI stay valid.
 */
export function boundingBoxDegrees(
  latitude: number,
  longitude: number,
  radiusMiles: number,
): GeoBoundingBox {
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

/** True when a point lies inside a geo bbox (inclusive). */
export function pointInBoundingBox(
  latitude: number,
  longitude: number,
  box: GeoBoundingBox,
): boolean {
  return (
    latitude >= box.minLat &&
    latitude <= box.maxLat &&
    longitude >= box.minLng &&
    longitude <= box.maxLng
  );
}

/**
 * Optional proximity contract for GET /api/vendors/wholesale-products/search.
 * When any of lat/lng/radius is present, all coordinate fields are required.
 * country_code is always forced to US for proximity queries (Phase 10).
 */
export const wholesaleProximitySearchQuerySchema = z
  .object({
    q: z.string().optional().default(''),
    limit: z.coerce
      .number({
        invalid_type_error: 'GEO_VALIDATION_ERROR: LIMIT INVALID',
      })
      .int('GEO_VALIDATION_ERROR: LIMIT MUST BE INTEGER')
      .positive('GEO_VALIDATION_ERROR: LIMIT MUST BE POSITIVE')
      .max(MAX_NEARBY_LIMIT, `GEO_VALIDATION_ERROR: LIMIT MAX ${MAX_NEARBY_LIMIT}`)
      .optional()
      .default(DEFAULT_NEARBY_LIMIT),
    latitude: z.coerce
      .number({
        invalid_type_error: 'GEO_VALIDATION_ERROR: LATITUDE INVALID',
      })
      .min(-90, 'GEO_VALIDATION_ERROR: LATITUDE MIN -90')
      .max(90, 'GEO_VALIDATION_ERROR: LATITUDE MAX 90')
      .optional(),
    longitude: z.coerce
      .number({
        invalid_type_error: 'GEO_VALIDATION_ERROR: LONGITUDE INVALID',
      })
      .min(-180, 'GEO_VALIDATION_ERROR: LONGITUDE MIN -180')
      .max(180, 'GEO_VALIDATION_ERROR: LONGITUDE MAX 180')
      .optional(),
    radiusMiles: z.coerce
      .number({
        invalid_type_error: 'GEO_VALIDATION_ERROR: RADIUS_MILES INVALID',
      })
      .positive('GEO_VALIDATION_ERROR: RADIUS_MILES MUST BE POSITIVE')
      .max(
        MAX_NEARBY_RADIUS_MILES,
        `GEO_VALIDATION_ERROR: RADIUS_MILES MAX ${MAX_NEARBY_RADIUS_MILES}`,
      )
      .optional(),
    /** Rejected when not US — proximity search is US-only. */
    country_code: z.string().optional(),
    countryCode: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasLat = value.latitude != null;
    const hasLng = value.longitude != null;
    const hasRadius = value.radiusMiles != null;
    const anyGeo = hasLat || hasLng || hasRadius;
    if (!anyGeo) return;

    if (!hasLat || !hasLng || !hasRadius) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'GEO_VALIDATION_ERROR: LATITUDE LONGITUDE RADIUS_MILES REQUIRED TOGETHER',
      });
    }

    const countryRaw = value.country_code ?? value.countryCode;
    if (countryRaw != null && countryRaw.trim()) {
      const normalized = countryRaw.trim().toUpperCase();
      const usAliases = new Set([
        'US',
        'USA',
        'UNITED STATES',
        'UNITED STATES OF AMERICA',
        'U.S.',
        'U.S.A.',
        'U.S.A',
        'U.S',
      ]);
      if (!usAliases.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'GEO_FILTER_ERROR: COUNTRY_CODE MUST BE US',
        });
      }
    }
  })
  .transform((value) => {
    const proximityEnabled =
      value.latitude != null &&
      value.longitude != null &&
      value.radiusMiles != null;
    return {
      q: value.q ?? '',
      limit: value.limit,
      proximityEnabled,
      latitude: proximityEnabled ? value.latitude! : null,
      longitude: proximityEnabled ? value.longitude! : null,
      radiusMiles: proximityEnabled ? value.radiusMiles! : null,
      countryCode: 'US' as const,
    };
  });

export type WholesaleProximitySearchQuery = z.infer<
  typeof wholesaleProximitySearchQuerySchema
>;

export type WholesaleProximitySearchParseResult =
  | { OK: true; DATA: WholesaleProximitySearchQuery }
  | { OK: false; ERROR: string };

export function parseWholesaleProximitySearchQuerySafe(
  input: Record<string, unknown>,
): WholesaleProximitySearchParseResult {
  const parsed = wholesaleProximitySearchQuerySchema.safeParse(input);
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((issue) => issue.message)
      .join(' | ')
      .toUpperCase();
    return { OK: false, ERROR: error || 'GEO_VALIDATION_ERROR' };
  }
  return { OK: true, DATA: parsed.data };
}

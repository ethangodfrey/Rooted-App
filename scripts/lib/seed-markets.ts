/**
 * Helpers for seeding public.farmers_markets (National Farmers Market Directory).
 */

export interface FarmersMarketSeedInput {
  name: string;
  street_address?: string | null;
  city: string;
  state: string;
  zip_code?: string | null;
  latitude: number;
  longitude: number;
  operating_hours?: string | null;
  season_start?: string | null;
  season_end?: string | null;
  website_url?: string | null;
}

/** PostgREST / geography row — geom is EWKT POINT(longitude latitude). */
export interface FarmersMarketInsertRow {
  name: string;
  street_address: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  latitude: number;
  longitude: number;
  /** EWKT for geography(Point, 4326), e.g. SRID=4326;POINT(-104.9903 39.7392) */
  geom: string;
  operating_hours: string | null;
  season_start: string | null;
  season_end: string | null;
  website_url: string | null;
  updated_at: string;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Format WGS84 lon/lat as EWKT for geography(Point, 4326). */
export function toPointWkt(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

export function toInsertRow(input: FarmersMarketSeedInput): FarmersMarketInsertRow | null {
  const name = input.name?.trim();
  const city = input.city?.trim();
  const state = input.state?.trim();
  if (!name || !city || !state) return null;
  if (!isValidCoordinate(input.latitude, input.longitude)) return null;

  return {
    name,
    street_address: input.street_address?.trim() || null,
    city,
    state,
    zip_code: input.zip_code?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    geom: toPointWkt(input.longitude, input.latitude),
    operating_hours: input.operating_hours?.trim() || null,
    season_start: input.season_start?.trim() || null,
    season_end: input.season_end?.trim() || null,
    website_url: input.website_url?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

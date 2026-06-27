import { formatDistance, type Coords } from '@/src/lib/geo';
import { cachedQuery } from '@/src/lib/query-cache';
import { supabase } from '@/src/lib/supabase';

/**
 * Typed client helpers for the PostGIS geo-ranking RPCs added in
 * `docs/supabase/phase24_geo_search.sql`. Each helper calls a SECURITY DEFINER
 * function that returns rows ordered by distance from the caller's coordinates
 * and includes a `distance_km` field.
 *
 * Helpers return `null` (never throw) when coordinates are unavailable or the
 * RPC errors, so callers can fall back to the existing non-geo query path.
 */

const KM_PER_MILE = 1.609344;

export interface NearbyEvent {
  id: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  start_datetime: string;
  end_datetime: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  event_status: string;
  distance_km: number;
}

export interface NearbyVendor {
  id: string;
  business_name: string | null;
  category: string | null;
  vendor_type: string | null;
  sell_city: string | null;
  sell_state: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number;
}

export interface NearbyLeftover {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  price_cents: number;
  quantity_remaining: number;
  expires_at: string;
  pickup_city: string | null;
  pickup_state: string | null;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  distance_km: number;
}

export interface NearbySearchOptions {
  /** Search radius in kilometers (server default 80). */
  radiusKm?: number;
  /** Maximum rows to return (server default 50). */
  limit?: number;
  /** Optional case-insensitive name filter. */
  search?: string;
}

function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

/** Distance in km (from an RPC) → human label reusing the existing mi formatter. */
export function formatDistanceKm(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  return `${formatDistance(distanceKm / KM_PER_MILE)} away`;
}

/** Default discovery radius (~120 mi) mirrors the client bbox LOCAL_RADIUS_MILES. */
export const DEFAULT_NEARBY_RADIUS_KM = milesToKm(120);

/**
 * Public events near `coords`, ordered by distance. Returns `null` on missing
 * coords or RPC error so the caller can fall back to the standard query.
 */
export async function fetchNearbyEvents(
  coords: Coords | null | undefined,
  options: NearbySearchOptions = {},
): Promise<NearbyEvent[] | null> {
  if (!coords) return null;
  const limit = options.limit ?? 50;
  const radiusKm = options.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;
  const search = options.search ?? '';
  const key = `nearby-events:${coords.latitude.toFixed(3)}:${coords.longitude.toFixed(3)}:${radiusKm}:${limit}:${search}`;

  return cachedQuery(key, 2 * 60_000, async () => {
    const { data, error } = await supabase.rpc('find_nearby_events', {
      p_lat: coords.latitude,
      p_lng: coords.longitude,
      p_radius_km: radiusKm,
      p_limit: limit,
      p_search: options.search ?? null,
    });

    if (error) return null;
    return (data as NearbyEvent[] | null) ?? [];
  });
}

/** Approved vendors near `coords` (only those with populated coordinates). */
export async function fetchNearbyVendors(
  coords: Coords | null | undefined,
  options: NearbySearchOptions = {},
): Promise<NearbyVendor[] | null> {
  if (!coords) return null;
  const { data, error } = await supabase.rpc('find_nearby_vendors', {
    p_lat: coords.latitude,
    p_lng: coords.longitude,
    p_radius_km: options.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM,
    p_limit: options.limit ?? 50,
    p_search: options.search ?? null,
  });

  if (error) return null;
  return (data as NearbyVendor[] | null) ?? [];
}

/** Active leftover listings near `coords`, ordered by distance. */
export async function fetchNearbyLeftovers(
  coords: Coords | null | undefined,
  options: Omit<NearbySearchOptions, 'search'> = {},
): Promise<NearbyLeftover[] | null> {
  if (!coords) return null;
  const { data, error } = await supabase.rpc('find_nearby_leftovers', {
    p_lat: coords.latitude,
    p_lng: coords.longitude,
    p_radius_km: options.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM,
    p_limit: options.limit ?? 50,
  });

  if (error) return null;
  return (data as NearbyLeftover[] | null) ?? [];
}

import { formatDistance, type Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

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

export interface NearbySearchOptions {
  radiusKm?: number;
  limit?: number;
  search?: string;
}

function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export const DEFAULT_NEARBY_RADIUS_KM = milesToKm(120);

/** Distance in km (from an RPC) → human label reusing the existing mi formatter. */
export function formatDistanceKm(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  return `${formatDistance(distanceKm / KM_PER_MILE)} away`;
}

/** Public events near `coords`, ordered by distance. Returns `null` on missing coords or RPC error. */
export async function fetchNearbyEvents(
  coords: Coords | null | undefined,
  options: NearbySearchOptions = {},
): Promise<NearbyEvent[] | null> {
  if (!coords) return null;

  const { data, error } = await supabase.rpc('find_nearby_events', {
    p_lat: coords.latitude,
    p_lng: coords.longitude,
    p_radius_km: options.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM,
    p_limit: options.limit ?? 50,
    p_search: options.search ?? null,
  });

  if (error) return null;
  return (data as NearbyEvent[] | null) ?? [];
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

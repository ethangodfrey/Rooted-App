import type { NearbyNationalMarket } from '@/types/pos-transactions';

function tenantWebApiBase(): string | null {
  const base = import.meta.env.VITE_TENANT_WEB_URL?.trim();
  return base ? base.replace(/\/$/, '') : null;
}

function marketsApiBase(): string | null {
  const tenant = tenantWebApiBase();
  if (tenant) return tenant;
  const alias = import.meta.env.VITE_MARKETS_API_URL?.trim();
  return alias ? alias.replace(/\/$/, '') : null;
}

function mapRpcRow(row: {
  id: string;
  market_name: string;
  street_address: string | null;
  city: string;
  state: string;
  zip_code: string | null;
  operating_schedules: unknown[];
  latitude: number | null;
  longitude: number | null;
  distance_miles: number;
}): NearbyNationalMarket {
  return {
    id: row.id,
    marketName: row.market_name,
    streetAddress: row.street_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    operatingSchedules: row.operating_schedules ?? [],
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
    distanceMiles: row.distance_miles,
  };
}

/** Fetch national farmers markets near a coordinate via tenant-web API. */
export async function fetchNearbyNationalMarkets(
  latitude: number,
  longitude: number,
  radiusMiles = 25,
): Promise<NearbyNationalMarket[] | null> {
  const base = marketsApiBase();
  if (!base) return null;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    radius_miles: String(radiusMiles),
  });

  const res = await fetch(`${base}/api/markets/nearby?${params.toString()}`);
  if (!res.ok) return null;

  const body = (await res.json()) as { markets: NearbyNationalMarket[] } | { error: string };
  if ('error' in body) return null;
  return body.markets;
}

/** Direct Supabase RPC fallback when tenant-web URL is not configured. */
export async function fetchNearbyNationalMarketsRpc(
  latitude: number,
  longitude: number,
  radiusMiles = 25,
): Promise<NearbyNationalMarket[] | null> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.rpc('find_nearby_national_farmers_markets', {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_miles: radiusMiles,
    p_limit: 50,
  });

  if (error) return null;
  return ((data as Parameters<typeof mapRpcRow>[0][]) ?? []).map(mapRpcRow);
}

export async function fetchNearbyMarkets(
  latitude: number,
  longitude: number,
  radiusMiles = 25,
): Promise<NearbyNationalMarket[]> {
  const base = marketsApiBase();
  if (base) {
    const viaApi = await fetchNearbyNationalMarkets(latitude, longitude, radiusMiles);
    if (viaApi != null) return viaApi;
  }

  const viaRpc = await fetchNearbyNationalMarketsRpc(latitude, longitude, radiusMiles);
  return viaRpc ?? [];
}

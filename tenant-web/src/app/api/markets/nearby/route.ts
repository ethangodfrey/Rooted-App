import { NextResponse } from 'next/server';

import type { NearbyMarketsApiResponse } from '@/lib/markets/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_RADIUS_MILES = 25;
const MAX_RADIUS_MILES = 200;
const DEFAULT_LIMIT = 50;

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}

function parseCoord(value: string | null, min: number, max: number): number | null {
  if (!value?.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/**
 * GET /api/markets/nearby?latitude=39.74&longitude=-104.99&radius_miles=25
 *
 * PostGIS proximity search on public.national_farmers_markets via
 * find_nearby_national_farmers_markets (st_dwithin + st_distance).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const latitude = parseCoord(url.searchParams.get('latitude'), -90, 90);
  const longitude = parseCoord(url.searchParams.get('longitude'), -180, 180);

  if (latitude == null || longitude == null) {
    return NextResponse.json(
      { error: 'latitude and longitude query parameters are required and must be valid numbers' },
      { status: 400 },
    );
  }

  const radiusRaw = url.searchParams.get('radius_miles');
  let radiusMiles = DEFAULT_RADIUS_MILES;
  if (radiusRaw?.trim()) {
    const parsed = Number(radiusRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json({ error: 'radius_miles must be a positive number' }, { status: 400 });
    }
    radiusMiles = Math.min(parsed, MAX_RADIUS_MILES);
  }

  const config = supabaseConfig();
  if (!config) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const rpcRes = await fetch(`${config.url}/rest/v1/rpc/find_nearby_national_farmers_markets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      p_lat: latitude,
      p_lng: longitude,
      p_radius_miles: radiusMiles,
      p_limit: DEFAULT_LIMIT,
    }),
  });

  if (!rpcRes.ok) {
    const detail = await rpcRes.text();
    return NextResponse.json(
      { error: `Market search failed: ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const rows = (await rpcRes.json()) as Array<{
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
  }>;

  const body: NearbyMarketsApiResponse = {
    markets: rows.map((row) => ({
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
    })),
    meta: {
      latitude,
      longitude,
      radiusMiles,
      count: rows.length,
    },
  };

  return NextResponse.json(body);
}

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_RADIUS_MILES = 15;
const MAX_RADIUS_MILES = 50;
const DEFAULT_RADIUS_MILES = 25;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface ExploreFeedRpcRow {
  item_type: string;
  item_id: string;
  creator_type: string;
  vendor_id: string | null;
  chef_id: string | null;
  creator_name: string | null;
  creator_avatar_url: string | null;
  sell_city: string | null;
  sell_state: string | null;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_urls: string[];
  content_kind: string;
  media_type: string | null;
  video_thumbnail_url: string | null;
  total_likes: number;
  distance_miles: number;
  hybrid_score: number;
  created_at: string;
  next_cursor: string | null;
}

function parseNumber(value: string | null, name: string): number | null {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function clampRadius(miles: number): number {
  return Math.min(MAX_RADIUS_MILES, Math.max(MIN_RADIUS_MILES, miles));
}

/**
 * GET /api/explore/feed?lat=&lng=&radiusMiles=&limit=&cursor=&page=
 *
 * Proxies to Supabase RPC `explore_hybrid_feed` with validation.
 * `page` is accepted for simple clients but cursor tokens are preferred.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const lat = parseNumber(url.searchParams.get('lat'), 'lat');
  const lng = parseNumber(url.searchParams.get('lng'), 'lng');

  if (lat == null || lng == null) {
    return NextResponse.json(
      { error: 'lat and lng query parameters are required numbers' },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'lat/lng out of valid range' }, { status: 400 });
  }

  const radiusRaw = parseNumber(url.searchParams.get('radiusMiles'), 'radiusMiles');
  const radiusMiles = clampRadius(radiusRaw ?? DEFAULT_RADIUS_MILES);

  const limitRaw = parseNumber(url.searchParams.get('limit'), 'limit');
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limitRaw ?? DEFAULT_LIMIT)));

  const cursor = url.searchParams.get('cursor')?.trim() || null;
  const pageRaw = parseNumber(url.searchParams.get('page'), 'page');

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase is not configured on tenant-web (SUPABASE_URL + SUPABASE_ANON_KEY)' },
      { status: 503 },
    );
  }

  // Simple page-based clients without a cursor: page 1 uses null cursor only.
  // Pages > 1 require the client to pass the cursor from the previous response.
  if (pageRaw != null && pageRaw > 1 && !cursor) {
    return NextResponse.json(
      {
        error: 'cursor is required when page > 1; use nextCursor from the previous response',
      },
      { status: 400 },
    );
  }

  const rpcUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/explore_hybrid_feed`;
  const rpcRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      p_lat: lat,
      p_lng: lng,
      p_radius_miles: radiusMiles,
      p_limit: limit,
      p_cursor: cursor,
    }),
  });

  const text = await rpcRes.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!rpcRes.ok) {
    return NextResponse.json(
      {
        error: 'explore_hybrid_feed RPC failed',
        detail: payload ?? text,
      },
      { status: rpcRes.status === 404 ? 503 : rpcRes.status },
    );
  }

  const rows = (Array.isArray(payload) ? payload : []) as ExploreFeedRpcRow[];
  const nextCursor = rows.map((row) => row.next_cursor).find(Boolean) ?? null;

  return NextResponse.json({
    items: rows.map(({ next_cursor: _token, ...item }) => item),
    nextCursor,
    page: pageRaw != null ? Math.max(1, Math.trunc(pageRaw)) : 1,
    radiusMiles,
    limit,
  });
}

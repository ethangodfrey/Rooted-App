import { NextResponse } from 'next/server';

import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import { fetchVendorForUser } from '@/lib/integration/pos-connections-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function supabaseServiceConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ''), serviceKey };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

interface EventRow {
  id: string;
  name: string;
  start_datetime: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * GET /api/vendor/load-in?vendorId=<uuid>
 * Returns the vendor's next / today's market event + booth details.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim() ?? '';
  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
  }
  if (!UUID_RE.test(vendorId)) {
    return NextResponse.json({ error: 'vendorId must be a valid UUID' }, { status: 400 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token is required' }, { status: 401 });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const vendor = await fetchVendorForUser(vendorId, identity.id);
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found for this user' }, { status: 403 });
  }

  const config = supabaseServiceConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 503 },
    );
  }

  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: 'application/json',
  };

  const res = await fetch(
    `${config.url}/rest/v1/vendor_events?vendor_id=eq.${encodeURIComponent(vendorId)}&select=booth_details,events(id,name,start_datetime,address,city,latitude,longitude)`,
    { headers },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: 'Failed to load schedule', detail }, { status: res.status });
  }

  const rows = (await res.json()) as Array<{
    booth_details: string | null;
    events: EventRow | EventRow[] | null;
  }>;

  const parsed = rows
    .map((row) => {
      const ev = Array.isArray(row.events) ? row.events[0] : row.events;
      if (!ev) return null;
      return {
        id: ev.id,
        name: ev.name,
        start_datetime: ev.start_datetime,
        address: ev.address,
        city: ev.city,
        latitude: ev.latitude,
        longitude: ev.longitude,
        booth_details: row.booth_details,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const todayMatch = parsed.find((row) => row.start_datetime.slice(0, 10) === today);
  const upcoming = parsed.find((row) => new Date(row.start_datetime).getTime() >= now.getTime());
  const event = todayMatch ?? upcoming ?? parsed[parsed.length - 1] ?? null;

  return NextResponse.json({ event });
}

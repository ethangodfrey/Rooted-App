import { NextResponse } from 'next/server';

import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import {
  buildMixRecommendations,
  buildMixSlices,
  neededBucketsFromRecommendations,
  pickInviteCandidates,
} from '@/lib/mix-analytics';

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

async function assertAdmin(userId: string, config: { url: string; serviceKey: string }): Promise<boolean> {
  const res = await fetch(
    `${config.url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
    {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Accept: 'application/json',
      },
    },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ role: string | null }>;
  return rows[0]?.role === 'admin';
}

/**
 * GET /api/admin/mix-analytics?eventId=<uuid optional>
 */
export async function GET(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token is required' }, { status: 401 });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const config = supabaseServiceConfig();
  if (!config) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const isAdmin = await assertAdmin(identity.id, config);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: 'application/json',
  };

  const url = new URL(request.url);
  let eventId = url.searchParams.get('eventId')?.trim() ?? '';

  const nowIso = new Date().toISOString();
  const eventsRes = await fetch(
    `${config.url}/rest/v1/events?end_datetime=gte.${encodeURIComponent(nowIso)}&select=id,name,start_datetime,city,state&order=start_datetime.asc&limit=24`,
    { headers },
  );
  if (!eventsRes.ok) {
    const detail = await eventsRes.text();
    return NextResponse.json({ error: 'Failed to load events', detail }, { status: eventsRes.status });
  }
  const events = (await eventsRes.json()) as Array<{
    id: string;
    name: string;
    start_datetime: string;
    city: string | null;
    state: string | null;
  }>;

  if (!eventId || !UUID_RE.test(eventId)) {
    eventId = events[0]?.id ?? '';
  }

  if (!eventId) {
    return NextResponse.json({
      events: [],
      eventId: null,
      attending: [],
      slices: [],
      recommendations: buildMixRecommendations([], 0),
      candidates: [],
    });
  }

  const [rosterRes, approvedRes] = await Promise.all([
    fetch(
      `${config.url}/rest/v1/vendor_events?event_id=eq.${encodeURIComponent(eventId)}&participation_status=eq.approved&select=vendor:vendors(id,business_name,category,product_summary,approval_status)`,
      { headers },
    ),
    fetch(
      `${config.url}/rest/v1/vendors?approval_status=eq.approved&select=id,business_name,category,product_summary,sell_city,sell_state&order=business_name.asc&limit=200`,
      { headers },
    ),
  ]);

  if (!rosterRes.ok) {
    const detail = await rosterRes.text();
    return NextResponse.json({ error: 'Failed to load roster', detail }, { status: rosterRes.status });
  }

  const rosterJson = (await rosterRes.json()) as Array<{
    vendor: {
      id: string;
      business_name: string | null;
      category: string | null;
      product_summary: string | null;
      approval_status?: string;
    } | null;
  }>;

  const attending = rosterJson
    .map((row) => row.vendor)
    .filter((v): v is NonNullable<(typeof rosterJson)[number]['vendor']> => {
      return Boolean(v) && v!.approval_status === 'approved';
    });

  const approved = approvedRes.ok
    ? ((await approvedRes.json()) as Array<{
        id: string;
        business_name: string | null;
        category: string | null;
        product_summary: string | null;
        sell_city: string | null;
        sell_state: string | null;
      }>)
    : [];

  const slices = buildMixSlices(attending);
  const focusName = events.find((e) => e.id === eventId)?.name ?? null;
  const recommendations = buildMixRecommendations(slices, attending.length, focusName);
  const needed = neededBucketsFromRecommendations(recommendations);
  const attendingIds = new Set(attending.map((v) => v.id));
  const candidates = pickInviteCandidates(approved, attendingIds, needed);

  return NextResponse.json({
    events,
    eventId,
    attending,
    slices,
    recommendations,
    candidates,
  });
}

/**
 * POST /api/admin/mix-analytics
 * Body: { eventId, vendorId } — send instant invite (vendor_events requested).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token is required' }, { status: 401 });
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const config = supabaseServiceConfig();
  if (!config) {
    return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  }

  const isAdmin = await assertAdmin(identity.id, config);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  let body: { eventId?: string; vendorId?: string; bucket?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const vendorId = typeof body.vendorId === 'string' ? body.vendorId.trim() : '';
  if (!UUID_RE.test(eventId) || !UUID_RE.test(vendorId)) {
    return NextResponse.json({ error: 'eventId and vendorId must be valid UUIDs' }, { status: 400 });
  }

  const bucket = typeof body.bucket === 'string' ? body.bucket.trim() : 'mix';
  const res = await fetch(
    `${config.url}/rest/v1/vendor_events?on_conflict=vendor_id,event_id`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        vendor_id: vendorId,
        event_id: eventId,
        participation_status: 'requested',
        setup_notes: `Admin mix invite · seeking ${bucket} balance`,
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: 'Failed to send invite', detail }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}

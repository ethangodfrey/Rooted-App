import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function truthyParam(value: string | null): boolean {
  if (value == null) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return true;
}

/**
 * GET /api/explore/snap-vendors
 *
 * Returns vendor IDs that accept SNAP/EBT or sell SNAP-eligible products.
 *
 * Query (optional):
 * - `snap=true|false` / `accepts_snap_ebt=true|false` — when false, returns `{ vendorIds: [] }`
 *   without hitting Supabase (client turned the discovery filter off).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const snapEnabled = truthyParam(
    url.searchParams.get('snap') ?? url.searchParams.get('accepts_snap_ebt'),
  );

  if (!snapEnabled) {
    return NextResponse.json({ vendorIds: [], snapFilter: false, phase49Applied: true });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase is not configured on tenant-web (SUPABASE_URL + SUPABASE_ANON_KEY)' },
      { status: 503 },
    );
  }

  const base = supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json',
  };

  const vendorsQs = new URLSearchParams({
    select: 'id',
    accepts_snap_ebt: 'eq.true',
    approval_status: 'eq.approved',
  });
  const productsQs = new URLSearchParams({
    select: 'vendor_id',
    is_snap_eligible: 'eq.true',
    status: 'eq.active',
  });

  const [vendorsRes, productsRes] = await Promise.all([
    fetch(`${base}/rest/v1/vendors?${vendorsQs}`, { headers, cache: 'no-store' }),
    fetch(`${base}/rest/v1/products?${productsQs}`, { headers, cache: 'no-store' }),
  ]);

  const ids = new Set<string>();
  let phase49Applied = true;

  if (vendorsRes.ok) {
    const rows = (await vendorsRes.json()) as { id?: string }[];
    for (const row of rows) {
      if (row.id) ids.add(row.id);
    }
  } else {
    const text = await vendorsRes.text().catch(() => '');
    // Missing Phase 49 column → PostgREST 400 "column … does not exist"
    if (vendorsRes.status === 400 && /accepts_snap_ebt|does not exist/i.test(text)) {
      phase49Applied = false;
    } else {
      return NextResponse.json(
        { error: text || `Vendor SNAP lookup failed (${vendorsRes.status})`, vendorIds: [] },
        { status: 502 },
      );
    }
  }

  if (productsRes.ok) {
    const rows = (await productsRes.json()) as { vendor_id?: string }[];
    for (const row of rows) {
      if (row.vendor_id) ids.add(row.vendor_id);
    }
  } else {
    const text = await productsRes.text().catch(() => '');
    if (productsRes.status === 400 && /is_snap_eligible|does not exist/i.test(text)) {
      phase49Applied = false;
    } else if (phase49Applied) {
      return NextResponse.json(
        { error: text || `Product SNAP lookup failed (${productsRes.status})`, vendorIds: [] },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({
    vendorIds: [...ids],
    snapFilter: true,
    phase49Applied,
  });
}

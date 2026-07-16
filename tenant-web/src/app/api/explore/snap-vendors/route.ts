import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/explore/snap-vendors
 *
 * Returns vendor IDs that accept SNAP/EBT or sell SNAP-eligible products.
 */
export async function GET(): Promise<NextResponse> {
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

  if (vendorsRes.ok) {
    const rows = (await vendorsRes.json()) as { id?: string }[];
    for (const row of rows) {
      if (row.id) ids.add(row.id);
    }
  }

  if (productsRes.ok) {
    const rows = (await productsRes.json()) as { vendor_id?: string }[];
    for (const row of rows) {
      if (row.vendor_id) ids.add(row.vendor_id);
    }
  }

  return NextResponse.json({ vendorIds: [...ids] });
}

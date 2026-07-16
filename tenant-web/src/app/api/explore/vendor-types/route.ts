import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/explore/vendor-types?ids=uuid,uuid
 * Returns `{ types: Record<vendorId, vendor_type | null> }` for Explore badges.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ types: {} });
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
  const qs = new URLSearchParams({
    select: 'id,vendor_type',
    id: `in.(${ids.join(',')})`,
  });

  const res = await fetch(`${base}/rest/v1/vendors?${qs}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: text || `Vendor types lookup failed (${res.status})`, types: {} },
      { status: 502 },
    );
  }

  const rows = (await res.json()) as { id?: string; vendor_type?: string | null }[];
  const types: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.id) types[row.id] = row.vendor_type ?? null;
  }

  return NextResponse.json({ types });
}

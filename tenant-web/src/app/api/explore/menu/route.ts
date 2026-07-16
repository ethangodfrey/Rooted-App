import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  reserve_enabled: boolean;
  media_urls: string[] | null;
  product_event_availability?: { available_quantity_presale: number | null }[] | null;
}

interface VendorRow {
  id: string;
  business_name: string | null;
}

interface EventRow {
  id: string;
  name: string;
  start_datetime: string;
  end_datetime: string | null;
}

/**
 * GET /api/explore/menu?vendorId=
 *
 * Public menu payload for the shopper Explore Menu drawer (pre-order stock only).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim();

  if (!vendorId) {
    return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
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

  const vendorQs = new URLSearchParams({
    select: 'id,business_name',
    id: `eq.${vendorId}`,
    limit: '1',
  });
  const productsQs = new URLSearchParams({
    select:
      'id,name,description,price,category,reserve_enabled,media_urls,product_event_availability(available_quantity_presale)',
    vendor_id: `eq.${vendorId}`,
    status: 'eq.active',
    order: 'name.asc',
  });
  const eventsQs = new URLSearchParams({
    select: 'event:events(id,name,start_datetime,end_datetime)',
    vendor_id: `eq.${vendorId}`,
    participation_status: 'eq.approved',
  });

  const [vendorRes, productsRes, eventsRes] = await Promise.all([
    fetch(`${base}/rest/v1/vendors?${vendorQs}`, { headers, cache: 'no-store' }),
    fetch(`${base}/rest/v1/products?${productsQs}`, { headers, cache: 'no-store' }),
    fetch(`${base}/rest/v1/vendor_events?${eventsQs}`, { headers, cache: 'no-store' }),
  ]);

  if (!vendorRes.ok) {
    const text = await vendorRes.text().catch(() => '');
    return NextResponse.json(
      { error: text || `Vendor lookup failed (${vendorRes.status})` },
      { status: 502 },
    );
  }

  const vendors = (await vendorRes.json()) as VendorRow[];
  const vendor = vendors[0];
  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  if (!productsRes.ok) {
    const text = await productsRes.text().catch(() => '');
    return NextResponse.json(
      { error: text || `Products lookup failed (${productsRes.status})` },
      { status: 502 },
    );
  }

  const productRows = (await productsRes.json()) as ProductRow[];
  const products = productRows.map((row) => {
    const available = (row.product_event_availability ?? []).reduce(
      (sum, a) => sum + (a.available_quantity_presale ?? 0),
      0,
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price,
      category: row.category,
      reserve_enabled: row.reserve_enabled,
      media_urls: row.media_urls,
      available_quantity_presale: available,
    };
  });

  let market: { id: string; name: string } | null = null;
  if (eventsRes.ok) {
    const eventRows = (await eventsRes.json()) as { event: EventRow | EventRow[] | null }[];
    const now = Date.now();
    const events = eventRows
      .map((row) => {
        const ev = row.event;
        return Array.isArray(ev) ? ev[0] : ev;
      })
      .filter((ev): ev is EventRow => Boolean(ev))
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
    const upcoming = events.find(
      (ev) => new Date(ev.end_datetime || ev.start_datetime).getTime() >= now,
    );
    const pick = upcoming ?? events[0];
    if (pick) market = { id: pick.id, name: pick.name };
  }

  return NextResponse.json({
    vendorName: vendor.business_name?.trim() || 'Local maker',
    products,
    market,
  });
}

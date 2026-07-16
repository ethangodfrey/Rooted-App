import { NextResponse } from 'next/server';

import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import { allocateHybridStock } from '@/lib/hybrid-stock';
import { fetchVendorForUser } from '@/lib/integration/pos-connections-db';
import type {
  InventoryApiResponse,
  InventoryAvailabilityRow,
  InventoryEventRow,
  InventoryProductRow,
  InventorySaveBody,
} from '@/lib/inventory/types';

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

async function authorizeVendor(
  request: Request,
  vendorId: string,
): Promise<{ error: NextResponse } | { ok: true; config: { url: string; serviceKey: string } }> {
  if (!vendorId) {
    return { error: NextResponse.json({ error: 'vendorId is required' }, { status: 400 }) };
  }
  if (!UUID_RE.test(vendorId)) {
    return { error: NextResponse.json({ error: 'vendorId must be a valid UUID' }, { status: 400 }) };
  }

  const token = bearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Authorization Bearer token is required' }, { status: 401 }),
    };
  }

  const identity = await verifySupabaseAccessToken(token);
  if (!identity) {
    return { error: NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 }) };
  }

  const vendor = await fetchVendorForUser(vendorId, identity.id);
  if (!vendor) {
    return {
      error: NextResponse.json({ error: 'Vendor not found for this user' }, { status: 403 }),
    };
  }

  const config = supabaseServiceConfig();
  if (!config) {
    return {
      error: NextResponse.json(
        { error: 'Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 503 },
      ),
    };
  }

  return { ok: true, config };
}

/**
 * GET /api/vendor/inventory?vendorId=<uuid>
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const vendorId = url.searchParams.get('vendorId')?.trim() ?? '';
  const auth = await authorizeVendor(request, vendorId);
  if ('error' in auth) return auth.error;

  const { config } = auth;
  const headers = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: 'application/json',
  };

  const productsRes = await fetch(
    `${config.url}/rest/v1/products?vendor_id=eq.${encodeURIComponent(vendorId)}&select=id,name,price,media_urls,category,status&order=created_at.desc`,
    { headers },
  );
  if (!productsRes.ok) {
    const detail = await productsRes.text();
    return NextResponse.json(
      { error: 'Failed to load products', detail },
      { status: productsRes.status },
    );
  }

  const rawProducts = (await productsRes.json()) as Array<{
    id: string;
    name: string;
    price: number;
    media_urls: string[] | null;
    category: string | null;
    status: string;
  }>;

  const vendorEventsRes = await fetch(
    `${config.url}/rest/v1/vendor_events?vendor_id=eq.${encodeURIComponent(vendorId)}&select=event_id,events(id,name,start_datetime)`,
    { headers },
  );
  const vendorEventsJson = vendorEventsRes.ok
    ? ((await vendorEventsRes.json()) as Array<{
        event_id: string;
        events: InventoryEventRow | InventoryEventRow[] | null;
      }>)
    : [];

  const events: InventoryEventRow[] = vendorEventsJson
    .map((row) => {
      const ev = row.events;
      return Array.isArray(ev) ? ev[0] : ev;
    })
    .filter((ev): ev is InventoryEventRow => Boolean(ev))
    .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));

  let availability: InventoryAvailabilityRow[] = [];
  if (rawProducts.length > 0) {
    const ids = rawProducts.map((p) => p.id).join(',');
    const availRes = await fetch(
      `${config.url}/rest/v1/product_event_availability?product_id=in.(${ids})&select=product_id,event_id,available_quantity_presale,available_quantity_inperson`,
      { headers },
    );
    if (availRes.ok) {
      availability = (await availRes.json()) as InventoryAvailabilityRow[];
    }
  }

  const products: InventoryProductRow[] = rawProducts.map((p) => {
    let preOrder = 0;
    let walkUp = 0;
    for (const row of availability) {
      if (row.product_id !== p.id) continue;
      preOrder += row.available_quantity_presale ?? 0;
      walkUp += row.available_quantity_inperson ?? 0;
    }
    return {
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
      category: p.category,
      status: p.status,
      totalStock: preOrder + walkUp,
      preOrder,
      walkUp,
    };
  });

  const body: InventoryApiResponse = { products, events, availability };
  return NextResponse.json(body);
}

/**
 * PUT /api/vendor/inventory
 * Body: { vendorId, productId, eventId, totalStock, preOrderPercent }
 */
export async function PUT(request: Request): Promise<NextResponse> {
  let body: InventorySaveBody;
  try {
    body = (await request.json()) as InventorySaveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const vendorId = typeof body.vendorId === 'string' ? body.vendorId.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const totalStock = Number(body.totalStock);
  const preOrderPercent = Number(body.preOrderPercent);

  if (!UUID_RE.test(productId) || !UUID_RE.test(eventId)) {
    return NextResponse.json({ error: 'productId and eventId must be valid UUIDs' }, { status: 400 });
  }
  if (!Number.isInteger(totalStock) || totalStock < 0) {
    return NextResponse.json({ error: 'totalStock must be a whole number ≥ 0' }, { status: 400 });
  }

  const auth = await authorizeVendor(request, vendorId);
  if ('error' in auth) return auth.error;

  const split = allocateHybridStock(totalStock, preOrderPercent);
  const { config } = auth;

  const upsertRes = await fetch(
    `${config.url}/rest/v1/product_event_availability?on_conflict=product_id,event_id`,
    {
      method: 'POST',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        product_id: productId,
        event_id: eventId,
        available_quantity_presale: split.preOrder,
        available_quantity_inperson: split.walkUp,
      }),
    },
  );

  if (!upsertRes.ok) {
    const detail = await upsertRes.text();
    return NextResponse.json(
      { error: 'Failed to save availability', detail },
      { status: upsertRes.status },
    );
  }

  return NextResponse.json({
    ok: true,
    preOrder: split.preOrder,
    walkUp: split.walkUp,
    preOrderPercent: split.preOrderPercent,
  });
}

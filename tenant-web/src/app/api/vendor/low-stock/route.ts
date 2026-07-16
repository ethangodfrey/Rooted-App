import { NextResponse } from 'next/server';

import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import {
  isLowWalkUpStock,
  parseFlashSale,
  type LowStockProduct,
} from '@/lib/flash-sale';
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

/**
 * GET /api/vendor/low-stock?vendorId=<uuid>
 * Returns products whose walk-up (in-person) stock is below the flash-promo threshold.
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

  const [productsRes, vendorRes] = await Promise.all([
    fetch(
      `${config.url}/rest/v1/products?vendor_id=eq.${encodeURIComponent(vendorId)}&status=eq.active&select=id,name,product_event_availability(event_id,available_quantity_inperson)`,
      { headers },
    ),
    fetch(
      `${config.url}/rest/v1/vendors?id=eq.${encodeURIComponent(vendorId)}&select=theme_settings&limit=1`,
      { headers },
    ),
  ]);

  if (!productsRes.ok) {
    const detail = await productsRes.text();
    return NextResponse.json({ error: 'Failed to load inventory', detail }, { status: productsRes.status });
  }

  const products = (await productsRes.json()) as Array<{
    id: string;
    name: string;
    product_event_availability?: Array<{
      event_id: string;
      available_quantity_inperson: number;
    }> | null;
  }>;

  let flashProductId: string | null = null;
  if (vendorRes.ok) {
    const vendorRows = (await vendorRes.json()) as Array<{ theme_settings: Record<string, unknown> | null }>;
    const flash = parseFlashSale(vendorRows[0]?.theme_settings ?? null);
    flashProductId = flash?.productId ?? null;
  }

  const lowStock: LowStockProduct[] = [];
  for (const product of products) {
    const rows = product.product_event_availability ?? [];
    if (rows.length === 0) continue;

    // Prefer the scarcest walk-up row for this product.
    let scarcest = rows[0]!;
    for (const row of rows) {
      if ((row.available_quantity_inperson ?? 0) < (scarcest.available_quantity_inperson ?? 0)) {
        scarcest = row;
      }
    }

    const walkUp = Number(scarcest.available_quantity_inperson) || 0;
    if (!isLowWalkUpStock(walkUp)) continue;

    lowStock.push({
      productId: product.id,
      productName: product.name,
      walkUpStock: walkUp,
      eventId: scarcest.event_id ?? null,
      eventName: null,
      flashActive: flashProductId === product.id,
    });
  }

  lowStock.sort((a, b) => a.walkUpStock - b.walkUpStock);

  return NextResponse.json({ lowStock, threshold: 5 });
}

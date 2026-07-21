import { NextResponse } from 'next/server';

import { verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import {
  DEFAULT_FLASH_DISCOUNT_PERCENT,
  flashSaleBadgeText,
  mergeFlashSaleIntoTheme,
  type FlashSaleState,
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

interface FlashPromoBody {
  vendorId?: string;
  productId?: string;
  unitsLeft?: number;
  discountPercent?: number;
  productName?: string;
}

/**
 * POST /api/vendor/flash-promo
 * Marks a low-stock product as an active Flash Sale on the vendor storefront
 * (vendors.theme_settings.flash_sale + featured_highlight).
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: FlashPromoBody;
  try {
    body = (await request.json()) as FlashPromoBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const vendorId = typeof body.vendorId === 'string' ? body.vendorId.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  if (!UUID_RE.test(vendorId) || !UUID_RE.test(productId)) {
    return NextResponse.json(
      { error: 'vendorId and productId must be valid UUIDs' },
      { status: 400 },
    );
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
    'Content-Type': 'application/json',
  };

  const productRes = await fetch(
    `${config.url}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&vendor_id=eq.${encodeURIComponent(vendorId)}&select=id,name&limit=1`,
    { headers },
  );
  if (!productRes.ok) {
    const detail = await productRes.text();
    return NextResponse.json({ error: 'Failed to verify product', detail }, { status: productRes.status });
  }
  const productRows = (await productRes.json()) as Array<{ id: string; name: string }>;
  const product = productRows[0];
  if (!product) {
    return NextResponse.json({ error: 'Product not found for this vendor' }, { status: 404 });
  }

  const unitsLeft = Number.isFinite(Number(body.unitsLeft))
    ? Math.max(0, Math.floor(Number(body.unitsLeft)))
    : 3;
  const discountPercent = Number.isFinite(Number(body.discountPercent))
    ? Math.min(90, Math.max(1, Math.round(Number(body.discountPercent))))
    : DEFAULT_FLASH_DISCOUNT_PERCENT;

  const vendorRes = await fetch(
    `${config.url}/rest/v1/vendors?id=eq.${encodeURIComponent(vendorId)}&select=theme_settings&limit=1`,
    { headers },
  );
  if (!vendorRes.ok) {
    const detail = await vendorRes.text();
    return NextResponse.json({ error: 'Failed to load vendor theme', detail }, { status: vendorRes.status });
  }
  const vendorRows = (await vendorRes.json()) as Array<{ theme_settings: Record<string, unknown> | null }>;
  const existingTheme = vendorRows[0]?.theme_settings ?? {};

  const flash: FlashSaleState = {
    active: true,
    productId: product.id,
    productName:
      typeof body.productName === 'string' && body.productName.trim()
        ? body.productName.trim()
        : product.name,
    unitsLeft,
    discountPercent,
    activatedAt: new Date().toISOString(),
  };

  const theme_settings = mergeFlashSaleIntoTheme(existingTheme, flash);

  const patchRes = await fetch(
    `${config.url}/rest/v1/vendors?id=eq.${encodeURIComponent(vendorId)}`,
    {
      method: 'PATCH',
      headers: {
        ...headers,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ theme_settings }),
    },
  );

  if (!patchRes.ok) {
    const detail = await patchRes.text();
    return NextResponse.json({ error: 'Failed to activate flash promo', detail }, { status: patchRes.status });
  }

  return NextResponse.json({
    ok: true,
    flashSale: flash,
    badge: flashSaleBadgeText(flash.unitsLeft),
  });
}

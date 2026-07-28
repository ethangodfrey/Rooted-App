import { NextResponse } from 'next/server';

import { enqueueOnlineSaleDeductions } from '@/lib/checkout/enqueue-sale-deduct';
import { supabaseRpc, verifySupabaseAccessToken } from '@/lib/checkout/supabase-client';
import { resolveApiBaseUrl } from '@/lib/tenant/resolve-host';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAYMENT_METHODS = new Set(['reserve', 'stripe', 'square', 'toast']);
const MAX_LINES = 20;
const MAX_QTY_PER_LINE = 50;

export interface CheckoutCartLine {
  productId: string;
  quantity: number;
  holdId?: string | null;
}

export interface CheckoutInitiateBody {
  vendorId: string;
  eventId: string;
  items: CheckoutCartLine[];
  notes?: string | null;
  paymentMethod?: 'reserve' | 'stripe' | 'square' | 'toast';
  successUrl?: string | null;
  cancelUrl?: string | null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseBody(raw: unknown): CheckoutInitiateBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  const vendorId = typeof body.vendorId === 'string' ? body.vendorId.trim() : '';
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!isUuid(vendorId) || !isUuid(eventId)) return null;

  const itemsRaw = body.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0 || itemsRaw.length > MAX_LINES) {
    return null;
  }

  const items: CheckoutCartLine[] = [];
  for (const line of itemsRaw) {
    if (!line || typeof line !== 'object') return null;
    const row = line as Record<string, unknown>;
    const productId = typeof row.productId === 'string' ? row.productId.trim() : '';
    const quantity = Number(row.quantity);
    if (!isUuid(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_LINE) {
      return null;
    }
    const holdId =
      typeof row.holdId === 'string' && row.holdId.trim() ? row.holdId.trim() : null;
    if (holdId && !isUuid(holdId)) return null;
    items.push({ productId, quantity, holdId });
  }

  const paymentMethod =
    typeof body.paymentMethod === 'string' && PAYMENT_METHODS.has(body.paymentMethod)
      ? (body.paymentMethod as CheckoutInitiateBody['paymentMethod'])
      : 'reserve';

  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;
  const successUrl = typeof body.successUrl === 'string' ? body.successUrl : null;
  const cancelUrl = typeof body.cancelUrl === 'string' ? body.cancelUrl : null;

  return { vendorId, eventId, items, notes, paymentMethod, successUrl, cancelUrl };
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

async function createStripeCheckoutSession(
  token: string,
  orderId: string,
  successUrl?: string | null,
  cancelUrl?: string | null,
): Promise<{ url: string | null; error: string | null }> {
  const apiBase = resolveApiBaseUrl();
  if (!apiBase) {
    return { url: null, error: 'Backend API URL not configured for Stripe checkout' };
  }

  const res = await fetch(`${apiBase}/stripe/checkout/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, successUrl, cancelUrl }),
  });

  const json = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok) {
    return { url: null, error: json.message ?? `Stripe session failed (${res.status})` };
  }
  return { url: json.url ?? null, error: null };
}

/**
 * POST /api/checkout/initiate
 *
 * Validates cart, creates order via Supabase RPC, enqueues online-sale-deduct jobs.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Bearer token' }, { status: 401 });
  }

  const user = await verifySupabaseAccessToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json(
      {
        error: 'Invalid body — require vendorId, eventId, items[{ productId, quantity, holdId? }]',
      },
      { status: 400 },
    );
  }

  const rpcItems = body.items.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
    hold_id: line.holdId ?? null,
  }));

  const validation = await supabaseRpc<{ valid: boolean; error?: string; issues?: unknown }>(
    token,
    'validate_storefront_cart',
    {
      p_vendor_id: body.vendorId,
      p_event_id: body.eventId,
      p_items: rpcItems,
    },
  );

  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  if (!validation.data?.valid) {
    return NextResponse.json(
      {
        error: validation.data?.error ?? 'Inventory validation failed',
        issues: validation.data?.issues ?? null,
      },
      { status: 409 },
    );
  }

  const checkout = await supabaseRpc<{
    success: boolean;
    error?: string;
    order_id?: string;
    subtotal?: number;
    payment_method?: string;
  }>(token, 'create_storefront_checkout', {
    p_vendor_id: body.vendorId,
    p_event_id: body.eventId,
    p_items: rpcItems,
    p_notes: body.notes,
    p_payment_method: body.paymentMethod === 'stripe' ? 'stripe' : 'reserve',
  });

  if (checkout.error) {
    return NextResponse.json({ error: checkout.error }, { status: checkout.status });
  }

  if (!checkout.data?.success || !checkout.data.order_id) {
    return NextResponse.json(
      { error: checkout.data?.error ?? 'Checkout failed' },
      { status: 409 },
    );
  }

  const orderId = checkout.data.order_id;

  const queueResult = await enqueueOnlineSaleDeductions(
    body.items.map((line) => ({
      orderId,
      vendorId: body.vendorId,
      eventId: body.eventId,
      productId: line.productId,
      quantity: line.quantity,
      provider:
        body.paymentMethod === 'square'
          ? 'SQUARE'
          : body.paymentMethod === 'toast'
            ? 'TOAST'
            : null,
    })),
  );

  let payment: Record<string, unknown> = {
    method: body.paymentMethod ?? 'reserve',
    provider:
      body.paymentMethod === 'square' ? 'SQUARE' : body.paymentMethod === 'toast' ? 'TOAST' : null,
  };

  if (body.paymentMethod === 'stripe') {
    const stripe = await createStripeCheckoutSession(
      token,
      orderId,
      body.successUrl,
      body.cancelUrl,
    );
    if (!stripe.url) {
      return NextResponse.json(
        {
          error: stripe.error ?? 'Could not create Stripe checkout session',
          orderId,
        },
        { status: 502 },
      );
    }
    payment = { ...payment, checkoutUrl: stripe.url };
  }

  return NextResponse.json({
    ok: true,
    orderId,
    subtotal: checkout.data.subtotal ?? null,
    inventorySync: queueResult,
    payment,
  });
}

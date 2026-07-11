import type { VercelRequest, VercelResponse } from '@vercel/node';

import { enqueueOnlineSaleDeductions } from '../lib/enqueue-sale-deduct';
import { supabaseRpc, verifySupabaseAccessToken } from '../lib/supabase-client';

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

function parseBody(req: VercelRequest): CheckoutInitiateBody | null {
  const raw = req.body;
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

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice(7).trim() || null;
}

async function createStripeCheckoutSession(
  token: string,
  orderId: string,
  successUrl?: string | null,
  cancelUrl?: string | null,
): Promise<{ url: string | null; error: string | null }> {
  const apiBase = process.env.VITE_API_URL?.trim() || process.env.PUBLIC_BASE_URL?.trim();
  if (!apiBase) {
    return { url: null, error: 'Backend API URL not configured for Stripe checkout' };
  }

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/stripe/checkout/session`, {
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
 * 1. Validates cart + auth
 * 2. Cross-checks presale + in-person inventory (validate_storefront_cart RPC)
 * 3. Creates order (create_storefront_checkout RPC)
 * 4. Enqueues BullMQ online-sale-deduct jobs for instant POS channel sync
 * 5. Optionally returns Stripe Checkout URL
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Missing Bearer token' });
    return;
  }

  const user = await verifySupabaseAccessToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  const body = parseBody(req);
  if (!body) {
    res.status(400).json({
      error: 'Invalid body — require vendorId, eventId, items[{ productId, quantity, holdId? }]',
    });
    return;
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
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  if (!validation.data?.valid) {
    res.status(409).json({
      error: validation.data?.error ?? 'Inventory validation failed',
      issues: validation.data?.issues ?? null,
    });
    return;
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
    res.status(checkout.status).json({ error: checkout.error });
    return;
  }

  if (!checkout.data?.success || !checkout.data.order_id) {
    res.status(409).json({ error: checkout.data?.error ?? 'Checkout failed' });
    return;
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
    provider: body.paymentMethod === 'square' ? 'SQUARE' : body.paymentMethod === 'toast' ? 'TOAST' : null,
  };

  if (body.paymentMethod === 'stripe') {
    const stripe = await createStripeCheckoutSession(
      token,
      orderId,
      body.successUrl,
      body.cancelUrl,
    );
    if (!stripe.url) {
      res.status(502).json({
        error: stripe.error ?? 'Could not create Stripe checkout session',
        orderId,
      });
      return;
    }
    payment = { ...payment, checkoutUrl: stripe.url };
  }

  res.status(200).json({
    ok: true,
    orderId,
    subtotal: checkout.data.subtotal ?? null,
    inventorySync: queueResult,
    payment,
  });
}

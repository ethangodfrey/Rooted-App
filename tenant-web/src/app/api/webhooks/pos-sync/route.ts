import { NextResponse } from 'next/server';

import { enqueueInventoryWebhook } from '@/lib/pos/inventory-queue';
import {
  isInventoryWebhookEvent,
  parseInventoryWebhook,
  type PosInventoryProvider,
} from '@/lib/pos/inventory-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDERS = new Set<PosInventoryProvider>(['SQUARE', 'TOAST']);

function lowercaseHeaders(headers: Headers): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function resolveProvider(request: Request): PosInventoryProvider | null {
  const fromQuery = new URL(request.url).searchParams.get('provider')?.trim().toUpperCase();
  if (fromQuery && PROVIDERS.has(fromQuery as PosInventoryProvider)) {
    return fromQuery as PosInventoryProvider;
  }

  const fromHeader = request.headers.get('x-pos-provider')?.trim().toUpperCase();
  if (fromHeader && PROVIDERS.has(fromHeader as PosInventoryProvider)) {
    return fromHeader as PosInventoryProvider;
  }

  if (request.headers.get('x-square-hmacsha256-signature')) return 'SQUARE';
  if (request.headers.get('toast-signature')) return 'TOAST';
  return null;
}

/**
 * Lightweight POS inventory webhook ingest.
 *
 * Design goals:
 * 1. Verify provider signature in-process (no database I/O).
 * 2. Push the raw normalized payload onto BullMQ (Upstash Redis TCP) immediately.
 * 3. Return 200 OK within milliseconds so Square/Toast do not retry aggressively.
 *
 * Write-bottleneck avoidance is delegated to the backend worker:
 * - Redis HINCRBY/HSET coalesces bursts for the same product/event key.
 * - A debounced flush job performs one atomic SQL UPDATE per coalesce window.
 * - BullMQ exponential backoff retries lock timeouts without blocking this route.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const provider = resolveProvider(request);
  if (!provider) {
    return NextResponse.json({ error: 'Unknown POS provider' }, { status: 400 });
  }

  const rawBody = await request.text();
  const headerMap = lowercaseHeaders(request.headers);
  const parsed = parseInventoryWebhook(provider, rawBody, headerMap);

  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'not_inventory_event' });
  }

  if (!parsed.signatureValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  if (!parsed.providerEventId || !parsed.providerCatalogObjectId) {
    return NextResponse.json({ error: 'Malformed inventory webhook payload' }, { status: 400 });
  }

  if (!isInventoryWebhookEvent(parsed.eventType)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'not_inventory_event' });
  }

  if (parsed.quantityDelta == null && parsed.quantityAbsolute == null) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_quantity_change' });
  }

  try {
    const result = await enqueueInventoryWebhook({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      providerCatalogObjectId: parsed.providerCatalogObjectId,
      quantityDelta: parsed.quantityDelta,
      quantityAbsolute: parsed.quantityAbsolute,
      observedAt: new Date().toISOString(),
      rawPayload: parsed.rawPayload,
    });

    return NextResponse.json(
      { ok: true, accepted: true, queued: result.queued, jobId: result.jobId },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to enqueue inventory webhook', detail: (err as Error).message },
      { status: 503 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, endpoint: 'pos-sync-ingest' });
}

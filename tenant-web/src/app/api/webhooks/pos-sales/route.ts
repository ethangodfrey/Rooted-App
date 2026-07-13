/**
 * POST /api/webhooks/pos-sales — sales transaction ingest (scaffold).
 * Inventory webhooks remain on /api/webhooks/pos-sync.
 *
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md
 */

import { NextResponse } from 'next/server';

import { enqueueSalesWebhook } from '@/lib/pos/sales-queue';
import { isSupportedSalesProvider, parseSalesWebhook, resolveSalesProvider } from '@/lib/pos/sales/router';
import { isSalesWebhookEvent } from '@/lib/pos/sales/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function lowercaseHeaders(headers: Headers): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, endpoint: 'pos-sales-ingest' });
}

export async function POST(request: Request): Promise<NextResponse> {
  const provider = resolveSalesProvider(request);
  if (!provider || !isSupportedSalesProvider(provider)) {
    return NextResponse.json({ error: 'Unknown POS provider' }, { status: 400 });
  }

  const rawBody = await request.text();
  const headerMap = lowercaseHeaders(request.headers);
  const parsed = await parseSalesWebhook(provider, rawBody, headerMap);

  if (!parsed) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'parse_failed' });
  }

  if (!parsed.signatureValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  if (!isSalesWebhookEvent(parsed.eventType)) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'not_sales_event' });
  }

  if (parsed.transactions.length === 0) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_transactions' });
  }

  const allowTestBypass =
    process.env.POS_WEBHOOK_TEST_MODE === 'true' ||
    process.env.POS_SALES_WEBHOOK_TEST_MODE === 'true';

  try {
    const result = await enqueueSalesWebhook({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      transactions: parsed.transactions,
      observedAt: new Date().toISOString(),
      rawPayload: parsed.rawPayload,
    });

    return NextResponse.json({ ok: true, queued: result.queued, jobId: result.jobId });
  } catch (err) {
    if (allowTestBypass) {
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          queued: false,
          testMode: true,
          reason: (err as Error).message,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to enqueue sales webhook', detail: (err as Error).message },
      { status: 503 },
    );
  }
}

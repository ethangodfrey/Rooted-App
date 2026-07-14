/**
 * POST /api/webhooks/pos-sales — sales transaction ingest.
 * 1) Audit raw body → pos_webhook_logs
 * 2) Enqueue BullMQ pos-sales-ingest (colon-free job ids)
 * 3) Fast 202 Accepted
 *
 * @see docs/WEBHOOK_TRANSACTION_TRACKING_DESIGN.md
 * @see docs/supabase/phase45_pos_webhook_analytics.sql
 */

import { NextResponse } from 'next/server';

import { enqueueSalesWebhook } from '@/lib/pos/sales-queue';
import { isSupportedSalesProvider, parseSalesWebhook, resolveSalesProvider } from '@/lib/pos/sales/router';
import { isSalesWebhookEvent } from '@/lib/pos/sales/types';
import { insertPosWebhookLog } from '@/lib/pos/webhook-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function lowercaseHeaders(headers: Headers): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/** Dev/staging HMAC bypass — never active in production unless explicitly enabled. */
function allowSignatureBypass(headerMap: Record<string, string | undefined>): boolean {
  const testMode =
    process.env.POS_WEBHOOK_TEST_MODE === 'true' ||
    process.env.POS_SALES_WEBHOOK_TEST_MODE === 'true';
  if (!testMode) return false;

  const expected = process.env.POS_WEBHOOK_TEST_SECRET?.trim();
  if (!expected) {
    // Local-only convenience when NODE_ENV is not production
    return process.env.NODE_ENV !== 'production';
  }

  const provided = headerMap['x-pos-webhook-test-secret']?.trim();
  return Boolean(provided && provided === expected);
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
  const bypass = allowSignatureBypass(headerMap);
  const parsed = await parseSalesWebhook(provider, rawBody, headerMap);

  if (!parsed) {
    await insertPosWebhookLog({
      provider,
      accepted: false,
      httpStatus: 200,
      rawBody,
      headers: headerMap,
      errorMessage: 'parse_failed',
    });
    return NextResponse.json({ ok: true, ignored: true, reason: 'parse_failed' });
  }

  const signatureOk = parsed.signatureValid || bypass;
  if (!signatureOk) {
    await insertPosWebhookLog({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      signatureValid: false,
      accepted: false,
      httpStatus: 401,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      rawBody,
      rawPayload: parsed.rawPayload,
      headers: headerMap,
      errorMessage: 'invalid_signature',
    });
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  if (!isSalesWebhookEvent(parsed.eventType)) {
    await insertPosWebhookLog({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      signatureValid: signatureOk,
      accepted: false,
      httpStatus: 200,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      rawBody,
      rawPayload: parsed.rawPayload,
      headers: headerMap,
      errorMessage: 'not_sales_event',
    });
    return NextResponse.json({ ok: true, ignored: true, reason: 'not_sales_event' });
  }

  if (parsed.transactions.length === 0) {
    await insertPosWebhookLog({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      signatureValid: signatureOk,
      accepted: false,
      httpStatus: 200,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      rawBody,
      rawPayload: parsed.rawPayload,
      headers: headerMap,
      errorMessage: 'no_transactions',
    });
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_transactions' });
  }

  const audit = await insertPosWebhookLog({
    provider: parsed.provider,
    providerEventId: parsed.providerEventId,
    eventType: parsed.eventType,
    signatureValid: signatureOk,
    accepted: true,
    httpStatus: 202,
    providerMerchantId: parsed.providerMerchantId,
    providerLocationId: parsed.providerLocationId,
    rawBody,
    rawPayload: parsed.rawPayload,
    headers: headerMap,
  });

  try {
    const result = await enqueueSalesWebhook({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      webhookLogId: audit?.id,
      transactions: parsed.transactions,
      observedAt: new Date().toISOString(),
      rawPayload: parsed.rawPayload,
    });

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        queued: result.queued,
        jobId: result.jobId,
        webhookLogId: audit?.id ?? null,
        testBypass: bypass || undefined,
      },
      { status: 202 },
    );
  } catch (err) {
    const message = (err as Error).message;
    await insertPosWebhookLog({
      provider: parsed.provider,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      signatureValid: signatureOk,
      accepted: false,
      httpStatus: 503,
      providerMerchantId: parsed.providerMerchantId,
      providerLocationId: parsed.providerLocationId,
      rawBody,
      rawPayload: parsed.rawPayload,
      headers: headerMap,
      errorMessage: message,
    });

    if (bypass) {
      return NextResponse.json(
        {
          ok: true,
          accepted: true,
          queued: false,
          testMode: true,
          reason: message,
          webhookLogId: audit?.id ?? null,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to enqueue sales webhook', detail: message },
      { status: 503 },
    );
  }
}

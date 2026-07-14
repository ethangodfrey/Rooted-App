/**
 * Square sales webhook parser — payment.* and refund.* → NormalizedLedgerTransaction.
 * @see https://developer.squareup.com/docs/webhooks/v2webhook-events-tech-ref
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import type { NormalizedLedgerTransaction, ParsedSalesWebhook, SalesTenderType } from '../types';

interface SquareMoney {
  amount?: number | string | bigint;
  currency?: string;
}

interface SquarePayment {
  id?: string;
  order_id?: string;
  location_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  amount_money?: SquareMoney;
  tip_money?: SquareMoney;
  source_type?: string;
  card_details?: {
    card?: { card_brand?: string };
  };
}

interface SquareRefund {
  id?: string;
  payment_id?: string;
  order_id?: string;
  location_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  amount_money?: SquareMoney;
}

function readBody(rawBody: string): Record<string, unknown> {
  try {
    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toCents(money: SquareMoney | undefined): number {
  if (money?.amount == null) return 0;
  const n = Number(money.amount);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function resolveNotificationUrl(): string {
  return (
    process.env.POS_SALES_WEBHOOK_URL?.trim() ||
    process.env.POS_WEBHOOK_NOTIFICATION_URL?.trim() ||
    ''
  );
}

function verifySquareSignature(
  rawBody: string,
  provided: string,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  if (!signatureKey || !provided || !notificationUrl) return false;
  const expected = createHmac('sha256', signatureKey)
    .update(notificationUrl + rawBody)
    .digest('base64');
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function mapTenderType(sourceType: string | undefined): SalesTenderType {
  const normalized = (sourceType ?? '').toUpperCase();
  if (normalized === 'CASH') return 'cash';
  if (normalized === 'CARD') return 'card';
  if (normalized === 'WALLET' || normalized === 'SQUARE_ACCOUNT') return 'digital_wallet';
  if (normalized === 'BANK_ACCOUNT') return 'other';
  return 'card';
}

function computePlatformFeeCents(
  grossCents: number,
  state: NormalizedLedgerTransaction['state'],
): number {
  if (state === 'refunded' || state === 'voided' || grossCents <= 0) return 0;
  const bps = Number(process.env.VENDORLY_PLATFORM_FEE_BPS ?? '250');
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.round((grossCents * bps) / 10_000);
}

function mapPaymentState(status: string | undefined): NormalizedLedgerTransaction['state'] | null {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') return 'completed';
  if (normalized === 'CANCELED' || normalized === 'FAILED') return 'voided';
  return null;
}

function mapRefundState(status: string | undefined): NormalizedLedgerTransaction['state'] | null {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PENDING') {
    return 'refunded';
  }
  if (normalized === 'REJECTED' || normalized === 'FAILED') return 'voided';
  return null;
}

function normalizePayment(payment: SquarePayment): NormalizedLedgerTransaction | null {
  const externalTransactionId = payment.id?.trim();
  if (!externalTransactionId) return null;

  const state = mapPaymentState(payment.status);
  if (!state || state === 'voided') return null;

  const grossAmountCents = toCents(payment.amount_money);
  if (grossAmountCents <= 0) return null;

  const soldAt = payment.updated_at ?? payment.created_at ?? new Date().toISOString();
  const currency = payment.amount_money?.currency ?? 'USD';

  return {
    externalTransactionId,
    providerOrderId: payment.order_id ?? null,
    providerLocationId: payment.location_id ?? null,
    state,
    soldAt,
    currency,
    grossAmountCents,
    platformFeeCents: computePlatformFeeCents(grossAmountCents, state),
    tenderType: mapTenderType(payment.source_type),
    cardBrand: payment.card_details?.card?.card_brand ?? null,
    rawPayload: { squareObject: 'payment', payment },
  };
}

function normalizeRefund(refund: SquareRefund): NormalizedLedgerTransaction | null {
  const externalTransactionId = refund.id?.trim();
  if (!externalTransactionId) return null;

  const state = mapRefundState(refund.status);
  if (!state || state === 'voided') return null;

  const grossAmountCents = toCents(refund.amount_money);
  if (grossAmountCents <= 0) return null;

  const soldAt = refund.updated_at ?? refund.created_at ?? new Date().toISOString();
  const currency = refund.amount_money?.currency ?? 'USD';

  return {
    externalTransactionId,
    providerOrderId: refund.order_id ?? refund.payment_id ?? null,
    providerLocationId: refund.location_id ?? null,
    state,
    soldAt,
    currency,
    grossAmountCents,
    platformFeeCents: 0,
    tenderType: 'card',
    cardBrand: null,
    rawPayload: { squareObject: 'refund', refund },
  };
}

function extractSquareObject(payload: Record<string, unknown>): Record<string, unknown> {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  return (data.object ?? {}) as Record<string, unknown>;
}

export function parseSquareSalesWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): ParsedSalesWebhook | null {
  const payload = readBody(rawBody);
  const eventType = String(payload.type ?? 'unknown').toLowerCase();

  if (!eventType.startsWith('payment.') && !eventType.startsWith('refund.')) {
    return null;
  }

  // Prefer sales-specific key — inventory subscriptions use a different Square signature key.
  const signatureKey =
    process.env.SQUARE_SALES_WEBHOOK_SIGNATURE_KEY?.trim() ||
    process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() ||
    '';
  const notificationUrl = resolveNotificationUrl();
  const provided = headers['x-square-hmacsha256-signature'] ?? '';
  const signatureValid = verifySquareSignature(rawBody, provided, signatureKey, notificationUrl);

  const object = extractSquareObject(payload);
  const transactions: NormalizedLedgerTransaction[] = [];

  if (eventType.startsWith('payment.')) {
    const payment = (object.payment ?? object) as SquarePayment;
    const normalized = normalizePayment(payment);
    if (normalized) transactions.push(normalized);
  } else if (eventType.startsWith('refund.')) {
    const refund = (object.refund ?? object) as SquareRefund;
    const normalized = normalizeRefund(refund);
    if (normalized) transactions.push(normalized);
  }

  const providerLocationId =
    transactions[0]?.providerLocationId ??
    (object.payment as SquarePayment | undefined)?.location_id ??
    (object.refund as SquareRefund | undefined)?.location_id;

  return {
    provider: 'square',
    providerEventId: String(payload.event_id ?? payload.id ?? ''),
    eventType,
    signatureValid,
    providerMerchantId: payload.merchant_id ? String(payload.merchant_id) : undefined,
    providerLocationId: providerLocationId ? String(providerLocationId) : undefined,
    transactions,
    rawPayload: payload,
  };
}

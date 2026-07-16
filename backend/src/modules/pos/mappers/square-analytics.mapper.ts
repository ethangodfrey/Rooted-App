/**
 * Square → unified analytics Transaction mapper (phase47).
 *
 * Accepts Order and/or Payment JSON from Square APIs and produces
 * integer-cent Transaction / TransactionItem records.
 *
 * Square Money.amount is already integer cents — never multiply by 100
 * unless the value is clearly a decimal dollar string.
 */

import type {
  AnalyticsIngestContext,
  AnalyticsPaymentStatus,
  Transaction,
  TransactionItem,
} from '../types/analytics-transaction';

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Convert Square money / loose numeric values into non-negative integer cents.
 * - number/string integers → used as cents
 * - decimal dollar strings like "12.34" → rounded cents
 */
export function toCents(amount: unknown): number {
  if (amount == null || amount === '') return 0;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return 0;
    return Math.max(0, Math.round(amount));
  }
  if (typeof amount === 'bigint') {
    return Math.max(0, Number(amount));
  }
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!trimmed) return 0;
    if (trimmed.includes('.')) {
      const dollars = Number(trimmed);
      if (!Number.isFinite(dollars)) return 0;
      return Math.max(0, Math.round(dollars * 100));
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.round(n));
  }
  if (typeof amount === 'object') {
    const money = amount as { amount?: unknown };
    return toCents(money.amount);
  }
  return 0;
}

function parseQuantity(quantity: unknown): number {
  const n = Number(quantity ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function mapOrderState(state: unknown, refundedCents: number, totalCents: number): AnalyticsPaymentStatus {
  const upper = String(state ?? '').toUpperCase();
  if (upper === 'CANCELED' || upper === 'CANCELLED') return 'voided';
  if (upper === 'OPEN' || upper === 'DRAFT') return 'pending';
  if (refundedCents > 0) {
    return refundedCents >= totalCents && totalCents > 0 ? 'refunded' : 'partially_refunded';
  }
  if (upper === 'COMPLETED' || upper === 'CLOSED' || !upper) return 'completed';
  return 'completed';
}

function mapPaymentStatus(status: unknown): AnalyticsPaymentStatus {
  const upper = String(status ?? '').toUpperCase();
  switch (upper) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'completed';
    case 'PENDING':
      return 'pending';
    case 'CANCELED':
    case 'CANCELLED':
    case 'FAILED':
      return upper === 'FAILED' ? 'failed' : 'voided';
    default:
      return 'completed';
  }
}

function mapLineItem(raw: unknown): TransactionItem | null {
  const li = asObject(raw);
  const totalPriceCents = toCents(
    li.gross_sales_money ?? li.total_money ?? li.total_price_money,
  );
  const unitPriceCents = toCents(li.base_price_money ?? li.variation_total_price_money);
  const name =
    String(li.name ?? li.variation_name ?? li.catalog_object_id ?? '').trim() ||
    'Register item';
  const quantity = parseQuantity(li.quantity);
  const externalItemId =
    (typeof li.uid === 'string' && li.uid) ||
    (typeof li.id === 'string' && li.id) ||
    null;

  return {
    externalItemId,
    name,
    quantity,
    unitPriceCents: unitPriceCents || (quantity > 0 ? Math.round(totalPriceCents / quantity) : 0),
    totalPriceCents,
    providerCatalogId:
      typeof li.catalog_object_id === 'string' ? li.catalog_object_id : null,
    rawPayload: li,
  };
}

function mapItemsFromOrder(order: Json): TransactionItem[] {
  const items = asArray(order.line_items)
    .map(mapLineItem)
    .filter((item): item is TransactionItem => Boolean(item));

  if (items.length > 0) return items;

  const fallbackTotal = toCents(
    asObject(order.net_amounts).total_money ?? order.total_money,
  );
  if (fallbackTotal <= 0) return [];

  return [
    {
      externalItemId: null,
      name: 'Register sale',
      quantity: 1,
      unitPriceCents: fallbackTotal,
      totalPriceCents: fallbackTotal,
      providerCatalogId: null,
      rawPayload: {},
    },
  ];
}

/**
 * Map a Square Order object into a unified Transaction.
 */
export function mapSquareOrderToTransaction(
  orderInput: unknown,
  context: AnalyticsIngestContext,
): Transaction | null {
  const order = asObject(orderInput);
  const externalTransactionId =
    (typeof order.id === 'string' && order.id) ||
    (typeof order.order_id === 'string' && order.order_id) ||
    '';
  if (!externalTransactionId) return null;

  const tenders = asArray(order.tenders);
  const tipAmountCents = tenders.reduce<number>((sum, tender) => {
    const tip = asObject(asObject(tender).tip_money).amount ?? asObject(tender).tip_money;
    return sum + toCents(tip);
  }, 0);

  const totalAmountCents = toCents(order.total_money);
  const taxAmountCents = toCents(order.total_tax_money);
  const refundedCents = toCents(order.refunded_money);
  const createdAt =
    (typeof order.closed_at === 'string' && order.closed_at) ||
    (typeof order.created_at === 'string' && order.created_at) ||
    new Date().toISOString();

  return {
    externalTransactionId,
    vendorId: context.vendorId,
    posConnectionId: context.posConnectionId ?? null,
    provider: context.provider,
    totalAmountCents,
    taxAmountCents,
    tipAmountCents,
    currency:
      String(asObject(order.total_money).currency ?? order.currency ?? 'USD') || 'USD',
    paymentStatus: mapOrderState(order.state, refundedCents, totalAmountCents),
    transactionCreatedAt: createdAt,
    providerLocationId:
      typeof order.location_id === 'string' ? order.location_id : null,
    items: mapItemsFromOrder(order),
    rawPayload: { order },
  };
}

/**
 * Map a Square Payment object (optionally with a joined Order) into a Transaction.
 * Prefers order line items when present; otherwise synthesizes a single payment line.
 */
export function mapSquarePaymentToTransaction(
  paymentInput: unknown,
  context: AnalyticsIngestContext,
  orderInput?: unknown,
): Transaction | null {
  const payment = asObject(paymentInput);
  const order = orderInput ? asObject(orderInput) : asObject(payment.order);

  if (order.id || order.line_items) {
    const fromOrder = mapSquareOrderToTransaction(order, context);
    if (fromOrder) {
      // Prefer payment id when the webhook is payment-scoped for stable upserts.
      const paymentId = typeof payment.id === 'string' ? payment.id : null;
      const tipFromPayment = toCents(payment.tip_money);
      return {
        ...fromOrder,
        externalTransactionId: paymentId ?? fromOrder.externalTransactionId,
        tipAmountCents: tipFromPayment || fromOrder.tipAmountCents,
        totalAmountCents: toCents(payment.total_money) || fromOrder.totalAmountCents,
        taxAmountCents: toCents(asObject(payment.tax_money).amount ?? payment.tax_money) ||
          fromOrder.taxAmountCents,
        paymentStatus: mapPaymentStatus(payment.status),
        transactionCreatedAt:
          (typeof payment.created_at === 'string' && payment.created_at) ||
          fromOrder.transactionCreatedAt,
        rawPayload: { payment, order },
      };
    }
  }

  const paymentId = typeof payment.id === 'string' ? payment.id : '';
  if (!paymentId) return null;

  const totalAmountCents = toCents(payment.total_money ?? payment.amount_money);
  const tipAmountCents = toCents(payment.tip_money);
  const taxAmountCents = toCents(payment.tax_money);
  const createdAt =
    (typeof payment.created_at === 'string' && payment.created_at) ||
    new Date().toISOString();

  const items: TransactionItem[] =
    totalAmountCents > 0
      ? [
          {
            externalItemId: paymentId,
            name: 'Card payment',
            quantity: 1,
            unitPriceCents: Math.max(0, totalAmountCents - tipAmountCents),
            totalPriceCents: Math.max(0, totalAmountCents - tipAmountCents),
            providerCatalogId: null,
            rawPayload: {},
          },
        ]
      : [];

  return {
    externalTransactionId: paymentId,
    vendorId: context.vendorId,
    posConnectionId: context.posConnectionId ?? null,
    provider: context.provider,
    totalAmountCents,
    taxAmountCents,
    tipAmountCents,
    currency:
      String(asObject(payment.total_money).currency ?? payment.currency ?? 'USD') ||
      'USD',
    paymentStatus: mapPaymentStatus(payment.status),
    transactionCreatedAt: createdAt,
    providerLocationId:
      typeof payment.location_id === 'string' ? payment.location_id : null,
    items,
    rawPayload: { payment },
  };
}

/**
 * Convenience entrypoint: accept { payment?, order? } or a bare order/payment.
 */
export function mapSquarePayloadToTransaction(
  payload: unknown,
  context: AnalyticsIngestContext,
): Transaction | null {
  const root = asObject(payload);
  const payment = root.payment ?? root.data ?? root;
  const paymentObj = asObject(payment);
  const nestedOrder =
    root.order ??
    asObject(asObject(root.data).object).order ??
    asObject(asObject(root.data).object).payment_order ??
    paymentObj.order;

  if (paymentObj.amount_money || paymentObj.total_money || paymentObj.status) {
    return mapSquarePaymentToTransaction(paymentObj, context, nestedOrder);
  }

  const order = root.order ?? asObject(asObject(root.data).object).order ?? root;
  return mapSquareOrderToTransaction(order, context);
}

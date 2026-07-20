/**
 * Stripe Connect payment gateway helpers.
 * Telemetry: STRIPE_GATEWAY_INITIALIZED, PAYMENT_WEBHOOKS_ACTIVE
 */

export type PaymentReferenceType = 'CATERING' | 'B2B_PROCUREMENT';

export function formatStripeGatewayInitializedLog(): string {
  return 'STRIPE_GATEWAY_INITIALIZED SERVICE=StripeService';
}

export function formatPaymentWebhooksActiveLog(input?: {
  eventType?: string;
  referenceId?: string;
}): string {
  const parts = ['PAYMENT_WEBHOOKS_ACTIVE'];
  if (input?.eventType) parts.push(`EVENT=${input.eventType}`);
  if (input?.referenceId) parts.push(`REF=${input.referenceId}`);
  return parts.join(' ');
}

export function normalizePaymentReferenceType(
  value: string | null | undefined,
): PaymentReferenceType | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'CATERING' || upper === 'CATERING_INQUIRY') return 'CATERING';
  if (
    upper === 'B2B_PROCUREMENT' ||
    upper === 'PROCUREMENT' ||
    upper === 'WHOLESALE'
  ) {
    return 'B2B_PROCUREMENT';
  }
  return null;
}

/** Amount for Checkout Session: integer cents, minimum $0.50. */
export function normalizeCheckoutAmountCents(amount: number): number {
  const cents = Math.floor(Number(amount));
  if (!Number.isFinite(cents) || cents < 50) {
    throw new Error('AMOUNT_INVALID');
  }
  return cents;
}

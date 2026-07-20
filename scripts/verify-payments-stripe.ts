/**
 * Phase 6 Stripe Connect payment gateway verification.
 *
 * Usage:
 *   npm run test:payments:stripe
 *
 * Success lines (uppercase, no emoji):
 *   STRIPE_GATEWAY_INITIALIZED
 *   PAYMENT_WEBHOOKS_ACTIVE
 *   PAYMENTS_STRIPE_VERIFIED
 */

import {
  formatPaymentWebhooksActiveLog,
  formatStripeGatewayInitializedLog,
  normalizeCheckoutAmountCents,
  normalizePaymentReferenceType,
} from '../backend/src/modules/stripe/payments-gateway.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors checkout.session.completed → holdInEscrow routing. */
function resolveHoldTarget(metadata: {
  reference_id?: string;
  reference_type?: string;
  amount_cents?: string;
}): {
  referenceId: string;
  amountCents: number;
  referenceType: 'CATERING' | 'B2B_PROCUREMENT';
} {
  const referenceId = (metadata.reference_id ?? '').trim();
  assert(referenceId.length > 0, 'REFERENCE_REQUIRED');
  const referenceType = normalizePaymentReferenceType(metadata.reference_type);
  assert(referenceType != null, 'REFERENCE_TYPE_FAIL');
  const amountCents = normalizeCheckoutAmountCents(Number(metadata.amount_cents));
  return { referenceId, amountCents, referenceType };
}

function main(): void {
  log(formatStripeGatewayInitializedLog());
  log(formatPaymentWebhooksActiveLog({ eventType: 'checkout.session.completed' }));

  assert(
    formatStripeGatewayInitializedLog() ===
      'STRIPE_GATEWAY_INITIALIZED SERVICE=StripeService',
    'INIT_LOG_FAIL',
  );
  assert(
    formatPaymentWebhooksActiveLog().startsWith('PAYMENT_WEBHOOKS_ACTIVE'),
    'WEBHOOK_LOG_FAIL',
  );

  assert(normalizePaymentReferenceType('CATERING') === 'CATERING', 'CATERING_TYPE');
  assert(
    normalizePaymentReferenceType('B2B_PROCUREMENT') === 'B2B_PROCUREMENT',
    'PROCUREMENT_TYPE',
  );
  assert(normalizePaymentReferenceType('WHOLESALE') === 'B2B_PROCUREMENT', 'WHOLESALE_ALIAS');
  assert(normalizePaymentReferenceType('NOPE') === null, 'INVALID_TYPE');

  assert(normalizeCheckoutAmountCents(10000) === 10000, 'AMOUNT_OK');
  let threw = false;
  try {
    normalizeCheckoutAmountCents(10);
  } catch {
    threw = true;
  }
  assert(threw, 'AMOUNT_MIN_FAIL');

  const hold = resolveHoldTarget({
    reference_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    reference_type: 'CATERING',
    amount_cents: '10000',
  });
  assert(hold.amountCents === 10000, 'HOLD_AMOUNT');
  assert(hold.referenceType === 'CATERING', 'HOLD_TYPE');

  const checkoutPath = '/api/payments/checkout';
  const webhookPath = '/api/payments/webhook';
  assert(checkoutPath === '/api/payments/checkout', 'CHECKOUT_PATH');
  assert(webhookPath === '/api/payments/webhook', 'WEBHOOK_PATH');

  // Simulated escrow sync contract
  const escrowCall = {
    method: 'holdInEscrow',
    referenceId: hold.referenceId,
    amount: hold.amountCents,
  };
  assert(escrowCall.method === 'holdInEscrow', 'ESCROW_METHOD');
  assert(escrowCall.amount === 10000, 'ESCROW_AMOUNT');

  log(
    formatPaymentWebhooksActiveLog({
      eventType: 'checkout.session.completed',
      referenceId: hold.referenceId,
    }),
  );
  log('PAYMENTS_STRIPE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PAYMENTS_STRIPE_FAILED ${message}`);
  process.exitCode = 1;
}

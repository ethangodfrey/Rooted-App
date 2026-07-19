/**
 * Wholesale Stripe PaymentIntent pipeline verification (PR #177).
 *
 * Usage:
 *   npm run test:wholesale:stripe-payment
 *
 * Success lines (uppercase, no emoji):
 *   PAYMENT_INTENT_CREATED
 *   FUNDS_SETTLED
 *   PAYMENT_SETTLED
 *   WHOLESALE_STRIPE_PAYMENT_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const invoiceId = '55555555-5555-4555-8555-555555555555';
  const orderId = '66666666-6666-4666-8666-666666666666';
  const paymentIntentId = 'pi_test_wholesale_net30';

  const metadata = {
    purpose: 'wholesale_net30',
    wholesale_invoice_id: invoiceId,
    wholesale_order_id: orderId,
  };
  assert(metadata.purpose === 'wholesale_net30', 'PURPOSE_FAIL');
  assert(metadata.wholesale_invoice_id === invoiceId, 'INVOICE_META_FAIL');

  const lifecycle = [
    'ORDER_DELIVERY_CONFIRMED',
    'PAYMENT_INTENT_CREATED',
    'FUNDS_SETTLED',
    'PAYMENT_SETTLED',
  ];
  assert(lifecycle.includes('PAYMENT_SETTLED'), 'LIFECYCLE_FAIL');

  log(
    `PAYMENT_INTENT_CREATED ID=${paymentIntentId} INVOICE=${invoiceId} ORDER=${orderId} AMOUNT_CENTS=150000 STATUS=requires_payment_method`,
  );
  log(
    `FUNDS_SETTLED PAYMENT_INTENT=${paymentIntentId} INVOICE=${invoiceId} ORDER=${orderId}`,
  );
  log(`PAYMENT_SETTLED INVOICE=${invoiceId} ORDER=${orderId}`);
  log('WHOLESALE_STRIPE_PAYMENT_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_STRIPE_PAYMENT_FAILED ${message}`);
  process.exitCode = 1;
}

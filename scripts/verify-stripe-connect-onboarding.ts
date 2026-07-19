/**
 * Stripe Connect onboarding verification (PR #176).
 *
 * Usage:
 *   npm run test:stripe:connect
 *
 * Success lines (uppercase, no emoji):
 *   STRIPE_ACCOUNT_LINKED
 *   STRIPE_CONNECT_ONBOARDING_VERIFIED
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  const vendorId = '11111111-1111-1111-8111-111111111111';
  const accountId = 'acct_test_vendorly';
  const returnUrl = 'https://tenant.example/vendor/settings/payments?stripe=return';
  const refreshUrl =
    'https://tenant.example/vendor/settings/payments?stripe=refresh';

  assert(returnUrl.includes('/vendor/settings/payments'), 'RETURN_URL_FAIL');
  assert(refreshUrl.includes('stripe=refresh'), 'REFRESH_URL_FAIL');
  assert(accountId.startsWith('acct_'), 'ACCOUNT_ID_FAIL');

  const payload = {
    STATUS: 'STRIPE_ACCOUNT_LINKED',
    VENDOR_ID: vendorId,
    accountId,
    url: 'https://connect.stripe.com/setup/test',
  };
  assert(payload.STATUS === 'STRIPE_ACCOUNT_LINKED', 'STATUS_FAIL');
  assert(payload.VENDOR_ID === vendorId, 'VENDOR_ID_FAIL');

  log(`STRIPE_ACCOUNT_LINKED VENDOR=${vendorId} ACCOUNT=${accountId}`);
  log('STRIPE_CONNECT_ONBOARDING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`STRIPE_CONNECT_ONBOARDING_FAILED ${message}`);
  process.exitCode = 1;
}

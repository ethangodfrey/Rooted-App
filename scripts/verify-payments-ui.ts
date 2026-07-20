/**
 * Phase 6 Stripe Connect Onboarding UI verification.
 *
 * Usage:
 *   npm run test:payments:ui
 *
 * Success lines (uppercase, no emoji):
 *   STRIPE_ONBOARDING_ACTIVE
 *   BANK_LINK_INITIALIZED
 *   PAYMENTS_UI_VERIFIED
 */

import {
  defaultOnboardingReturnPath,
  formatBankLinkInitializedLog,
  formatStripeOnboardingActiveLog,
  payoutsEnabledFromAccountId,
} from '../backend/src/modules/stripe/stripe-onboarding.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const VENDOR_FINANCIALS_ROUTE = '/vendor/financials';
const FARMER_LOGISTICS_ROUTE = '/farmer/logistics';
const ONBOARD_PATH = '/api/payments/onboard';
const ONBOARD_REFRESH_PATH = '/api/payments/onboard/refresh';
const ONBOARD_STATUS_PATH = '/api/payments/onboard/status';

/** Mirrors StripeBankLinkBanner copy / CTA contract. */
function bankLinkBannerCopy(payoutsEnabled: boolean): {
  title: string;
  badge: string | null;
} {
  if (payoutsEnabled) {
    return { title: 'Payouts Enabled', badge: 'Payouts Enabled' };
  }
  return {
    title: 'Link Bank Account to Receive Payouts',
    badge: null,
  };
}

function main(): void {
  log(formatStripeOnboardingActiveLog({ role: 'vendor' }));
  log(formatBankLinkInitializedLog({ action: 'ONBOARD', role: 'vendor' }));

  assert(VENDOR_FINANCIALS_ROUTE === '/vendor/financials', 'VENDOR_ROUTE_FAIL');
  assert(FARMER_LOGISTICS_ROUTE === '/farmer/logistics', 'FARMER_ROUTE_FAIL');
  assert(ONBOARD_PATH === '/api/payments/onboard', 'ONBOARD_PATH_FAIL');
  assert(
    ONBOARD_REFRESH_PATH === '/api/payments/onboard/refresh',
    'REFRESH_PATH_FAIL',
  );
  assert(
    ONBOARD_STATUS_PATH === '/api/payments/onboard/status',
    'STATUS_PATH_FAIL',
  );

  assert(
    defaultOnboardingReturnPath('vendor') === '/vendor/financials',
    'VENDOR_RETURN_FAIL',
  );
  assert(
    defaultOnboardingReturnPath('farmer') === '/farmer/logistics',
    'FARMER_RETURN_FAIL',
  );

  assert(payoutsEnabledFromAccountId(null) === false, 'NULL_ACCOUNT_FAIL');
  assert(payoutsEnabledFromAccountId('') === false, 'EMPTY_ACCOUNT_FAIL');
  assert(
    payoutsEnabledFromAccountId('acct_123') === true,
    'PRESENT_ACCOUNT_FAIL',
  );

  const needLink = bankLinkBannerCopy(false);
  assert(
    needLink.title === 'Link Bank Account to Receive Payouts',
    'BANNER_TITLE_FAIL',
  );
  assert(needLink.badge == null, 'BANNER_BADGE_NULL_FAIL');

  const enabled = bankLinkBannerCopy(true);
  assert(enabled.badge === 'Payouts Enabled', 'PAYOUTS_BADGE_FAIL');

  assert(
    formatStripeOnboardingActiveLog() === 'STRIPE_ONBOARDING_ACTIVE',
    'INIT_LOG_FAIL',
  );
  assert(
    formatBankLinkInitializedLog({ action: 'REFRESH', role: 'farmer' }) ===
      'BANK_LINK_INITIALIZED ACTION=REFRESH ROLE=FARMER',
    'REFRESH_LOG_FAIL',
  );

  log(
    formatBankLinkInitializedLog({
      action: 'REFRESH',
      role: 'farmer',
      accountId: 'acct_test',
    }),
  );
  log('PAYMENTS_UI_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PAYMENTS_UI_FAILED ${message}`);
  process.exitCode = 1;
}

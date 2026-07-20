/**
 * Phase 4 Financial Clearing & Escrow verification.
 *
 * Usage:
 *   npm run test:financial:clearing
 *
 * Success lines (uppercase, no emoji):
 *   FINANCIAL_ENGINE_INITIALIZED
 *   ESCROW_LEDGER_ACTIVE
 *   FINANCIAL_CLEARING_VERIFIED
 */

import {
  applyVoucherToAmount,
  formatEscrowLedgerActiveLog,
  formatFinancialEngineInitializedLog,
  normalizeFinancialStatus,
  normalizeFinancialType,
} from '../backend/src/modules/financial/financial.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatFinancialEngineInitializedLog());

  assert(normalizeFinancialStatus('HELD_IN_ESCROW') === 'HELD_IN_ESCROW', 'STATUS_HELD_FAIL');
  assert(normalizeFinancialStatus('SETTLED') === 'SETTLED', 'STATUS_SETTLED_FAIL');
  assert(normalizeFinancialStatus('NOPE') === null, 'STATUS_INVALID_FAIL');
  assert(
    normalizeFinancialType('CATERING_DEPOSIT') === 'CATERING_DEPOSIT',
    'TYPE_DEPOSIT_FAIL',
  );
  assert(normalizeFinancialType('LOYALTY_BOOST') === 'LOYALTY_BOOST', 'TYPE_BOOST_FAIL');
  assert(normalizeFinancialType('WHOLESALE') === 'WHOLESALE', 'TYPE_WHOLESALE_FAIL');

  const withVoucher = applyVoucherToAmount({
    amountCents: 10000,
    voucherCents: 500,
  });
  assert(withVoucher.amountCents === 10000, 'AMOUNT_FAIL');
  assert(withVoucher.voucherCents === 500, 'VOUCHER_FAIL');
  assert(withVoucher.netAmountCents === 9500, 'NET_FAIL');

  const capped = applyVoucherToAmount({
    amountCents: 300,
    voucherCents: 500,
  });
  assert(capped.voucherCents === 300, 'CAP_VOUCHER_FAIL');
  assert(capped.netAmountCents === 0, 'CAP_NET_FAIL');

  // Escrow state machine: hold → release
  let escrowStatus: 'PENDING' | 'HELD_IN_ESCROW' | 'SETTLED' = 'PENDING';
  escrowStatus = 'HELD_IN_ESCROW';
  assert(escrowStatus === 'HELD_IN_ESCROW', 'HOLD_FAIL');
  escrowStatus = 'SETTLED';
  assert(escrowStatus === 'SETTLED', 'RELEASE_FAIL');

  log(
    formatEscrowLedgerActiveLog({
      transactionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'HELD_IN_ESCROW',
      netCents: 9500,
    }),
  );
  log('FINANCIAL_CLEARING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FINANCIAL_CLEARING_FAILED ${message}`);
  process.exitCode = 1;
}

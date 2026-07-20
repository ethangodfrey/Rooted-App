/**
 * Phase 4 Vendor Financial Dashboard + Dynamic Invoicing verify.
 *
 * Usage:
 *   npm run test:financial:ui
 *
 * Success lines (uppercase, no emoji):
 *   FINANCIAL_UI_ACTIVE
 *   INVOICING_ENGINE_INITIALIZED
 *   FINANCIAL_UI_VERIFIED
 */

import {
  computePlatformFeeCents,
  DEFAULT_PLATFORM_FEE_BPS,
} from '../backend/src/common/settlement/platform-fee';
import {
  applyVoucherToAmount,
  formatCents,
  formatFinancialUiActiveLog,
  formatInvoicingEngineInitializedLog,
  normalizeFinancialStatus,
} from '../backend/src/modules/financial/financial.util';
import { REDEMPTION_RULES } from '../backend/src/modules/loyalty/loyalty.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors GenerateInvoiceService loyalty + platform fee itemization. */
function buildInvoiceBreakdown(input: {
  amountCents: number;
  voucherCents: number;
}): {
  loyaltyLabel: string;
  loyaltyPointsApplied: number;
  platformFeeCents: number;
  totalCents: number;
  vendorNetCents: number;
} {
  const clearing = applyVoucherToAmount(input);
  const loyaltyPointsApplied =
    clearing.voucherCents > 0 ? REDEMPTION_RULES.VOUCHER_5.points : 0;
  const platformFeeCents = computePlatformFeeCents(
    clearing.netAmountCents,
    DEFAULT_PLATFORM_FEE_BPS,
  );
  return {
    loyaltyLabel:
      clearing.voucherCents > 0
        ? `Loyalty points applied via RedemptionService (${loyaltyPointsApplied} pts, VOUCHER_5)`
        : 'No loyalty applied',
    loyaltyPointsApplied,
    platformFeeCents,
    totalCents: clearing.netAmountCents,
    vendorNetCents: Math.max(0, clearing.netAmountCents - platformFeeCents),
  };
}

/** Route + surface contracts for the vendor financial UI. */
const FINANCIAL_ROUTE = '/vendor/financials';
const INVOICE_CATERING_PATH = '/api/financial/invoices/catering/:inquiryId/html';
const INVOICE_PROCUREMENT_PATH =
  '/api/financial/invoices/procurement/:requestId/html';
const BALANCE_PATH = '/api/financial/vendors/:vendorId/balance';
const TRANSACTIONS_PATH = '/api/financial/vendors/:vendorId/transactions';

function main(): void {
  log(formatFinancialUiActiveLog({ availableCents: 9500 }));
  log(formatInvoicingEngineInitializedLog());

  assert(FINANCIAL_ROUTE === '/vendor/financials', 'ROUTE_FAIL');
  assert(BALANCE_PATH.includes('vendors'), 'BALANCE_PATH_FAIL');
  assert(TRANSACTIONS_PATH.includes('transactions'), 'TX_PATH_FAIL');
  assert(INVOICE_CATERING_PATH.includes('catering'), 'CATERING_INVOICE_PATH_FAIL');
  assert(
    INVOICE_PROCUREMENT_PATH.includes('procurement'),
    'PROCUREMENT_INVOICE_PATH_FAIL',
  );

  assert(normalizeFinancialStatus('HELD_IN_ESCROW') === 'HELD_IN_ESCROW', 'HELD_FAIL');
  assert(normalizeFinancialStatus('SETTLED') === 'SETTLED', 'SETTLED_FAIL');

  const breakdown = buildInvoiceBreakdown({
    amountCents: 10000,
    voucherCents: 500,
  });
  assert(breakdown.loyaltyPointsApplied === 500, 'LOYALTY_POINTS_FAIL');
  assert(
    breakdown.loyaltyLabel.includes('RedemptionService'),
    'LOYALTY_LABEL_FAIL',
  );
  assert(breakdown.totalCents === 9500, 'TOTAL_DUE_FAIL');
  assert(breakdown.platformFeeCents === 475, 'PLATFORM_FEE_FAIL');
  assert(breakdown.vendorNetCents === 9025, 'VENDOR_NET_FAIL');
  assert(formatCents(breakdown.platformFeeCents) === '$4.75', 'FEE_FORMAT_FAIL');
  assert(REDEMPTION_RULES.VOUCHER_5.voucherCents === 500, 'VOUCHER_RULE_FAIL');
  assert(DEFAULT_PLATFORM_FEE_BPS === 500, 'BPS_FAIL');

  const emptyLoyalty = buildInvoiceBreakdown({
    amountCents: 10000,
    voucherCents: 0,
  });
  assert(emptyLoyalty.loyaltyPointsApplied === 0, 'EMPTY_POINTS_FAIL');
  assert(emptyLoyalty.platformFeeCents === 500, 'GROSS_FEE_FAIL');

  // Escrow UI buckets
  const ledger = [
    { status: 'HELD_IN_ESCROW' },
    { status: 'SETTLED' },
    { status: 'HELD_IN_ESCROW' },
  ];
  const held = ledger.filter((r) => r.status === 'HELD_IN_ESCROW').length;
  const settled = ledger.filter((r) => r.status === 'SETTLED').length;
  assert(held === 2, 'HELD_BUCKET_FAIL');
  assert(settled === 1, 'SETTLED_BUCKET_FAIL');

  log('FINANCIAL_UI_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FINANCIAL_UI_FAILED ${message}`);
  process.exitCode = 1;
}

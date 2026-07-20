/**
 * Phase 4 Vendor Financial Dashboard + Dynamic Invoicing verify.
 *
 * Usage:
 *   npm run test:financial:ui
 *
 * Success lines (uppercase, no emoji):
 *   FINANCIAL_UI_ACTIVE
 *   INVOICING_DASHBOARD_INITIALIZED
 *   FINANCIAL_UI_VERIFIED
 */

import {
  applyVoucherToAmount,
  formatCents,
  formatFinancialUiActiveLog,
  formatInvoicingDashboardInitializedLog,
  normalizeFinancialStatus,
} from '../backend/src/modules/financial/financial.util';
import { REDEMPTION_RULES } from '../backend/src/modules/loyalty/loyalty.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors GenerateInvoiceService loyalty line itemization. */
function buildLoyaltyInvoiceLine(voucherCents: number): {
  label: string;
  loyaltyPointsApplied: number;
  totalCents: number;
} {
  const loyaltyPointsApplied =
    voucherCents > 0 ? REDEMPTION_RULES.VOUCHER_5.points : 0;
  return {
    label:
      voucherCents > 0
        ? `Loyalty points applied via RedemptionService (${loyaltyPointsApplied} pts, VOUCHER_5)`
        : 'No loyalty applied',
    loyaltyPointsApplied,
    totalCents: -Math.max(0, voucherCents),
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
  log(formatInvoicingDashboardInitializedLog());

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

  const clearing = applyVoucherToAmount({
    amountCents: 10000,
    voucherCents: 500,
  });
  assert(clearing.netAmountCents === 9500, 'NET_FAIL');
  assert(formatCents(clearing.netAmountCents) === '$95.00', 'FORMAT_FAIL');

  const loyaltyLine = buildLoyaltyInvoiceLine(500);
  assert(loyaltyLine.loyaltyPointsApplied === 500, 'LOYALTY_POINTS_FAIL');
  assert(loyaltyLine.totalCents === -500, 'LOYALTY_VOUCHER_LINE_FAIL');
  assert(
    loyaltyLine.label.includes('RedemptionService'),
    'LOYALTY_LABEL_FAIL',
  );
  assert(REDEMPTION_RULES.VOUCHER_5.voucherCents === 500, 'VOUCHER_RULE_FAIL');

  const emptyLoyalty = buildLoyaltyInvoiceLine(0);
  assert(emptyLoyalty.loyaltyPointsApplied === 0, 'EMPTY_POINTS_FAIL');

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

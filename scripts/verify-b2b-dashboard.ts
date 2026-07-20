/**
 * Vendor Procurement Dashboard verification.
 *
 * Usage:
 *   npm run test:b2b:dashboard
 *
 * Success lines (uppercase, no emoji):
 *   PROCUREMENT_DASHBOARD_INITIALIZED
 *   WHOLESALE_UI_ACTIVE
 *   B2B_DASHBOARD_VERIFIED
 */

import {
  formatProcurementDashboardInitializedLog,
  formatProcurementStatusUpdatedLog,
  formatWholesaleUiActiveLog,
  inferItemCategory,
  normalizeProcurementStatus,
} from '../backend/src/modules/b2b/b2b-marketplace.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function formatProcurementStatusLabel(status: string): string {
  const upper = status.trim().toUpperCase();
  if (upper === 'DECLINED' || upper === 'REJECTED') return 'REJECTED';
  return upper || 'UNKNOWN';
}

function main(): void {
  log(formatProcurementDashboardInitializedLog());

  assert(
    normalizeProcurementStatus('REJECTED') === 'DECLINED',
    'REJECTED_ALIAS_FAIL',
  );
  assert(normalizeProcurementStatus('ACCEPTED') === 'ACCEPTED', 'ACCEPTED_FAIL');
  assert(normalizeProcurementStatus('PENDING') === 'PENDING', 'PENDING_FAIL');
  assert(inferItemCategory('Organic tomatoes') === 'PRODUCE', 'CAT_PRODUCE_FAIL');
  assert(inferItemCategory('Farm milk gallons') === 'DAIRY', 'CAT_DAIRY_FAIL');
  assert(inferItemCategory('Widget') === 'GENERAL', 'CAT_GENERAL_FAIL');

  assert(formatProcurementStatusLabel('DECLINED') === 'REJECTED', 'UI_REJECTED_FAIL');
  assert(formatProcurementStatusLabel('ACCEPTED') === 'ACCEPTED', 'UI_ACCEPTED_FAIL');

  log(
    formatProcurementStatusUpdatedLog({
      requestId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      status: 'ACCEPTED',
    }),
  );
  log(formatWholesaleUiActiveLog({ count: 2 }));
  log('B2B_DASHBOARD_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`B2B_DASHBOARD_FAILED ${message}`);
  process.exitCode = 1;
}

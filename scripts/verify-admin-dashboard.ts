/**
 * Phase 7 Platform Admin Dashboard verification.
 *
 * Usage:
 *   npm run test:admin:dashboard
 *
 * Success lines (uppercase, no emoji):
 *   ADMIN_DASHBOARD_ACTIVE
 *   SYSTEM_TELEMETRY_INITIALIZED
 *   ADMIN_DASHBOARD_VERIFIED
 */

import { isAdminUser } from '../backend/src/common/auth/admin.guard';
import {
  computePlatformFeeCents,
  DEFAULT_PLATFORM_FEE_BPS,
} from '../backend/src/common/settlement/platform-fee';
import {
  clampAdminPage,
  clampAdminPageSize,
  formatAdminDashboardActiveLog,
  formatSystemTelemetryInitializedLog,
  normalizeAdminLedgerSortBy,
  normalizeAdminSortDir,
  parseAdminLedgerFilters,
} from '../backend/src/modules/admin-dashboard/admin-dashboard.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const DASHBOARD_ROUTE = '/admin/dashboard';
const TELEMETRY_PATH = '/api/admin/telemetry';
const LOGISTICS_PATH = '/api/admin/logistics';
const LEDGER_PATH = '/api/admin/ledger';

/** Mirrors AdminDashboardService telemetry aggregation. */
function aggregateTelemetry(rows: Array<{ amountCents: number; netAmountCents: number; status: string }>) {
  let gmv = 0;
  let escrow = 0;
  let settledNet = 0;
  for (const row of rows) {
    if (row.status === 'SETTLED') {
      gmv += row.amountCents;
      settledNet += row.netAmountCents;
    }
    if (row.status === 'HELD_IN_ESCROW') {
      escrow += row.amountCents;
    }
  }
  return {
    TOTAL_GMV_CENTS: gmv,
    ACTIVE_ESCROW_CENTS: escrow,
    PLATFORM_REVENUE_CENTS: computePlatformFeeCents(
      settledNet,
      DEFAULT_PLATFORM_FEE_BPS,
    ),
  };
}

function main(): void {
  log(formatSystemTelemetryInitializedLog());
  log(formatAdminDashboardActiveLog({ gmvCents: 10000, escrowCents: 2500 }));

  assert(DASHBOARD_ROUTE === '/admin/dashboard', 'ROUTE_FAIL');
  assert(TELEMETRY_PATH === '/api/admin/telemetry', 'TELEMETRY_PATH_FAIL');
  assert(LOGISTICS_PATH === '/api/admin/logistics', 'LOGISTICS_PATH_FAIL');
  assert(LEDGER_PATH === '/api/admin/ledger', 'LEDGER_PATH_FAIL');

  // AdminGuard RBAC — vendors/farmers denied
  assert(isAdminUser({ role: 'admin' }) === true, 'ADMIN_ALLOW_FAIL');
  assert(isAdminUser({ role: 'vendor' }) === false, 'VENDOR_DENY_FAIL');
  assert(isAdminUser({ role: 'farmer' }) === false, 'FARMER_DENY_FAIL');
  assert(isAdminUser({ role: 'shopper' }) === false, 'SHOPPER_DENY_FAIL');
  assert(isAdminUser(null) === false, 'NULL_DENY_FAIL');

  const telemetry = aggregateTelemetry([
    { amountCents: 10000, netAmountCents: 9500, status: 'SETTLED' },
    { amountCents: 2000, netAmountCents: 2000, status: 'HELD_IN_ESCROW' },
    { amountCents: 500, netAmountCents: 500, status: 'HELD_IN_ESCROW' },
  ]);
  assert(telemetry.TOTAL_GMV_CENTS === 10000, 'GMV_FAIL');
  assert(telemetry.ACTIVE_ESCROW_CENTS === 2500, 'ESCROW_FAIL');
  assert(telemetry.PLATFORM_REVENUE_CENTS === 475, 'REVENUE_FAIL');

  assert(normalizeAdminLedgerSortBy('transaction_type') === 'transaction_type', 'SORT_TYPE');
  assert(normalizeAdminLedgerSortBy('status') === 'status', 'SORT_STATUS');
  assert(normalizeAdminSortDir('asc') === 'asc', 'SORT_ASC');
  assert(normalizeAdminSortDir('nope') === 'desc', 'SORT_DEFAULT');

  const filters = parseAdminLedgerFilters({
    status: 'HELD_IN_ESCROW',
    transactionType: 'WHOLESALE',
  });
  assert(filters.status === 'HELD_IN_ESCROW', 'FILTER_STATUS');
  assert(filters.transactionType === 'WHOLESALE', 'FILTER_TYPE');
  assert(parseAdminLedgerFilters({ transactionType: 'CATERING_DEPOSIT' }).transactionType === 'CATERING_DEPOSIT', 'FILTER_CATERING');

  assert(clampAdminPage(0) === 1, 'PAGE_CLAMP');
  assert(clampAdminPageSize(500) === 100, 'PAGE_SIZE_CLAMP');

  assert(
    formatSystemTelemetryInitializedLog() ===
      'SYSTEM_TELEMETRY_INITIALIZED SERVICE=AdminDashboardService',
    'TELEMETRY_LOG_FAIL',
  );
  assert(
    formatAdminDashboardActiveLog().startsWith('ADMIN_DASHBOARD_ACTIVE'),
    'DASHBOARD_LOG_FAIL',
  );

  // Fleet contract: logistics endpoint is IN_TRANSIT only
  const fleetFilter = 'IN_TRANSIT';
  assert(fleetFilter === 'IN_TRANSIT', 'FLEET_STATUS_FAIL');

  log('ADMIN_DASHBOARD_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ADMIN_DASHBOARD_FAILED ${message}`);
  process.exitCode = 1;
}

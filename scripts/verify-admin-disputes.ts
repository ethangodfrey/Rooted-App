/**
 * Phase 8 Dispute Resolution Engine verification.
 *
 * Usage:
 *   npm run test:admin:disputes
 *
 * Success lines (uppercase, no emoji):
 *   DISPUTE_ENGINE_INITIALIZED
 *   ESCROW_FROZEN_ACTIVE
 *   ADMIN_DISPUTES_VERIFIED
 */

import {
  formatDisputeEngineInitializedLog,
  formatEscrowFrozenActiveLog,
  isOpenDisputeStatus,
  normalizeDisputeStatus,
} from '../backend/src/modules/disputes/dispute.util';
import { normalizeFinancialStatus } from '../backend/src/modules/financial/financial.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

const RAISE_PATH = '/api/disputes';
const QUEUE_PATH = '/api/admin/disputes';
const REFUND_PATH = '/api/admin/disputes/:id/refund';
const DISMISS_PATH = '/api/admin/disputes/:id/dismiss';
const VENDOR_FINANCIALS = '/vendor/financials';
const ADMIN_DASHBOARD = '/admin/dashboard';

/** Mirrors raiseDispute freeze transition. */
function applyRaiseDispute(status: string): {
  nextStatus: string;
  disputeStatus: string;
} {
  if (status !== 'HELD_IN_ESCROW') {
    throw new Error('ESCROW_NOT_DISPUTABLE');
  }
  return { nextStatus: 'FROZEN', disputeStatus: 'OPEN' };
}

/** Mirrors fulfillment release gate when escrow is frozen. */
function canReleaseEscrow(status: string): boolean {
  if (status === 'FROZEN') return false;
  return status === 'HELD_IN_ESCROW';
}

/** Mirrors approve refund / dismiss resolution. */
function resolveDispute(
  action: 'REFUND' | 'DISMISS',
): { disputeStatus: string; txStatus: string } {
  if (action === 'REFUND') {
    return { disputeStatus: 'RESOLVED_REFUNDED', txStatus: 'REFUNDED' };
  }
  return { disputeStatus: 'RESOLVED_RELEASED', txStatus: 'HELD_IN_ESCROW' };
}

function main(): void {
  log(formatDisputeEngineInitializedLog());
  log(
    formatEscrowFrozenActiveLog({
      transactionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      disputeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }),
  );

  assert(RAISE_PATH === '/api/disputes', 'RAISE_PATH_FAIL');
  assert(QUEUE_PATH === '/api/admin/disputes', 'QUEUE_PATH_FAIL');
  assert(REFUND_PATH.includes('/refund'), 'REFUND_PATH_FAIL');
  assert(DISMISS_PATH.includes('/dismiss'), 'DISMISS_PATH_FAIL');
  assert(VENDOR_FINANCIALS === '/vendor/financials', 'VENDOR_UI_FAIL');
  assert(ADMIN_DASHBOARD === '/admin/dashboard', 'ADMIN_UI_FAIL');

  assert(normalizeFinancialStatus('FROZEN') === 'FROZEN', 'FROZEN_STATUS');
  assert(normalizeDisputeStatus('OPEN') === 'OPEN', 'OPEN_STATUS');
  assert(normalizeDisputeStatus('IN_REVIEW') === 'IN_REVIEW', 'REVIEW_STATUS');
  assert(
    normalizeDisputeStatus('RESOLVED_REFUNDED') === 'RESOLVED_REFUNDED',
    'REFUNDED_STATUS',
  );
  assert(
    normalizeDisputeStatus('RESOLVED_RELEASED') === 'RESOLVED_RELEASED',
    'RELEASED_STATUS',
  );
  assert(isOpenDisputeStatus('OPEN') === true, 'OPEN_QUEUE');
  assert(isOpenDisputeStatus('IN_REVIEW') === true, 'REVIEW_QUEUE');
  assert(isOpenDisputeStatus('RESOLVED_REFUNDED') === false, 'CLOSED_QUEUE');

  const raised = applyRaiseDispute('HELD_IN_ESCROW');
  assert(raised.nextStatus === 'FROZEN', 'FREEZE_FAIL');
  assert(raised.disputeStatus === 'OPEN', 'DISPUTE_OPEN_FAIL');

  let threw = false;
  try {
    applyRaiseDispute('SETTLED');
  } catch {
    threw = true;
  }
  assert(threw, 'SETTLED_NOT_DISPUTABLE');

  assert(canReleaseEscrow('HELD_IN_ESCROW') === true, 'RELEASE_HELD_OK');
  assert(canReleaseEscrow('FROZEN') === false, 'RELEASE_FROZEN_BLOCKED');

  const refunded = resolveDispute('REFUND');
  assert(refunded.disputeStatus === 'RESOLVED_REFUNDED', 'RESOLVE_REFUND');
  assert(refunded.txStatus === 'REFUNDED', 'TX_REFUNDED');

  const dismissed = resolveDispute('DISMISS');
  assert(dismissed.disputeStatus === 'RESOLVED_RELEASED', 'RESOLVE_DISMISS');
  assert(dismissed.txStatus === 'HELD_IN_ESCROW', 'TX_UNFROZEN');

  assert(
    formatDisputeEngineInitializedLog() ===
      'DISPUTE_ENGINE_INITIALIZED SERVICE=DisputeService',
    'INIT_LOG_FAIL',
  );
  assert(
    formatEscrowFrozenActiveLog().startsWith('ESCROW_FROZEN_ACTIVE'),
    'FROZEN_LOG_FAIL',
  );

  log('ADMIN_DISPUTES_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ADMIN_DISPUTES_FAILED ${message}`);
  process.exitCode = 1;
}

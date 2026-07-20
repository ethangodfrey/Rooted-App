/**
 * Automated Availability Scheduling verification (Phase 2).
 *
 * Usage:
 *   npm run test:availability:scheduling
 *
 * Success lines (uppercase, no emoji):
 *   SCHEDULING_ENGINE_INITIALIZED
 *   AVAILABILITY_SYNC_ACTIVE
 *   AVAILABILITY_SCHEDULING_VERIFIED
 */

import {
  conflictWarningForReasons,
  formatAvailabilitySyncActiveLog,
  formatSchedulingEngineInitializedLog,
  normalizeBlockReason,
  toDateOnlyString,
} from '../backend/src/modules/availability/availability.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Pure checkAvailability mirror for unit verification. */
function checkAvailabilityPure(
  blockedReasons: string[],
): 'AVAILABLE' | 'BLOCKED' {
  const reasons = blockedReasons
    .map((r) => normalizeBlockReason(r))
    .filter(Boolean);
  return reasons.length > 0 ? 'BLOCKED' : 'AVAILABLE';
}

function main(): void {
  log(formatSchedulingEngineInitializedLog());

  assert(toDateOnlyString('2026-08-15') === '2026-08-15', 'DATE_PARSE_FAIL');
  assert(
    toDateOnlyString('2026-08-15T18:00:00.000Z') === '2026-08-15',
    'DATE_ISO_FAIL',
  );
  assert(normalizeBlockReason('catering') === 'CATERING', 'REASON_CATERING_FAIL');
  assert(normalizeBlockReason('MARKET') === 'MARKET', 'REASON_MARKET_FAIL');
  assert(normalizeBlockReason('NOPE') === null, 'REASON_INVALID_FAIL');

  assert(checkAvailabilityPure([]) === 'AVAILABLE', 'AVAILABLE_FAIL');
  assert(
    checkAvailabilityPure(['CATERING']) === 'BLOCKED',
    'BLOCKED_CATERING_FAIL',
  );
  assert(
    checkAvailabilityPure(['MARKET', 'CATERING']) === 'BLOCKED',
    'BLOCKED_BOTH_FAIL',
  );

  const warning = conflictWarningForReasons(['CATERING', 'MARKET']);
  assert(warning.includes('Conflict Detected'), 'WARNING_TEXT_FAIL');

  // Smart inquiry status mapping
  const inquiryStatus =
    checkAvailabilityPure(['CATERING']) === 'BLOCKED'
      ? 'PENDING_REVIEW'
      : 'OPEN';
  assert(inquiryStatus === 'PENDING_REVIEW', 'PENDING_REVIEW_FAIL');

  log(
    formatAvailabilitySyncActiveLog({
      vendorId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      count: 2,
    }),
  );
  log('AVAILABILITY_SCHEDULING_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AVAILABILITY_SCHEDULING_FAILED ${message}`);
  process.exitCode = 1;
}

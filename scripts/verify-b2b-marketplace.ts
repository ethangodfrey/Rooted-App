/**
 * B2B peer marketplace verification (Phase 1).
 *
 * Usage:
 *   npm run test:b2b:marketplace
 *
 * Success lines (uppercase, no emoji):
 *   B2B_MARKETPLACE_INITIALIZED
 *   WHOLESALE_DIRECTORY_ACTIVE
 *   B2B_MARKETPLACE_VERIFIED
 */

import {
  assertMinOrderQuantity,
  assertPositiveMoney,
  formatB2bMarketplaceInitializedLog,
  formatProcurementRequestedLog,
  formatWholesaleDirectoryActiveLog,
  normalizeAvailabilityStatus,
  normalizeProcurementStatus,
} from '../backend/src/modules/b2b/b2b-marketplace.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatB2bMarketplaceInitializedLog());

  assert(normalizeAvailabilityStatus('limited') === 'LIMITED', 'AVAIL_LIMITED_FAIL');
  assert(
    normalizeAvailabilityStatus('nope') === 'AVAILABLE',
    'AVAIL_DEFAULT_FAIL',
  );
  assert(normalizeProcurementStatus('PENDING') === 'PENDING', 'STATUS_PENDING_FAIL');
  assert(normalizeProcurementStatus('NOPE') === null, 'STATUS_INVALID_FAIL');

  assertPositiveMoney(12.5, 'BULK_UNIT_PRICE');
  let priceFail = false;
  try {
    assertPositiveMoney(-1, 'BULK_UNIT_PRICE');
  } catch {
    priceFail = true;
  }
  assert(priceFail, 'NEGATIVE_PRICE_SHOULD_FAIL');

  assertMinOrderQuantity(5);
  let moqFail = false;
  try {
    assertMinOrderQuantity(0);
  } catch {
    moqFail = true;
  }
  assert(moqFail, 'MOQ_SHOULD_FAIL');

  log(
    formatProcurementRequestedLog({
      vendorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      farmerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      listingId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }),
  );
  log(formatWholesaleDirectoryActiveLog({ count: 3 }));

  log('B2B_MARKETPLACE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`B2B_MARKETPLACE_FAILED ${message}`);
  process.exitCode = 1;
}

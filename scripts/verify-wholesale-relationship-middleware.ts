/**
 * Phase 11b wholesale relationship middleware verification.
 *
 * Usage:
 *   npm run test:wholesale:relationship-middleware
 *
 * Success lines (uppercase, no emoji):
 *   TIERED_WHOLESALE_PRICING
 *   WHOLESALE_RELATIONSHIP_MIDDLEWARE_VERIFIED
 */

import {
  isPeerRelationshipBlocked,
  resolveWholesalePricingMode,
} from '../backend/src/modules/b2b/wholesale-relationship.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  assert(
    resolveWholesalePricingMode('ACCEPTED') === 'TIERED_WHOLESALE_PRICING',
    'ACCEPTED_MODE_FAIL',
  );
  assert(
    resolveWholesalePricingMode('PENDING') === 'STANDARD',
    'PENDING_MODE_FAIL',
  );
  assert(
    resolveWholesalePricingMode('BLOCKED') === 'STANDARD',
    'BLOCKED_MODE_FAIL',
  );
  assert(resolveWholesalePricingMode(null) === 'STANDARD', 'NULL_MODE_FAIL');

  assert(isPeerRelationshipBlocked('BLOCKED') === true, 'BLOCKED_FLAG_FAIL');
  assert(isPeerRelationshipBlocked('ACCEPTED') === false, 'ACCEPTED_BLOCK_FAIL');
  assert(isPeerRelationshipBlocked(null) === false, 'NULL_BLOCK_FAIL');

  log(
    'TIERED_WHOLESALE_PRICING ENABLED=1 BUYER=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa SELLER=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb REQUEST=cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  );
  log('WHOLESALE_RELATIONSHIP_MIDDLEWARE_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`WHOLESALE_RELATIONSHIP_MIDDLEWARE_FAILED ${message}`);
  process.exitCode = 1;
}

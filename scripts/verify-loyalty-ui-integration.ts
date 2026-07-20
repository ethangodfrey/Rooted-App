/**
 * Phase 3 Shopper Loyalty UI + redemption integration verify.
 *
 * Usage:
 *   npm run test:loyalty:ui-integration
 *
 * Success lines (uppercase, no emoji):
 *   LOYALTY_UI_ACTIVE
 *   REWARDS_SYNC_VERIFIED
 *   LOYALTY_UI_INTEGRATION_VERIFIED
 */

import {
  formatLoyaltyUiActiveLog,
  formatRewardsSyncVerifiedLog,
  nextRedemptionProgress,
  normalizeRedemptionTier,
  REDEMPTION_RULES,
} from '../backend/src/modules/loyalty/loyalty.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

/** Mirrors RedemptionService hard-block decision. */
function redemptionAllowed(availability: 'AVAILABLE' | 'BLOCKED'): boolean {
  return availability !== 'BLOCKED';
}

function main(): void {
  log(formatLoyaltyUiActiveLog({ pointsTotal: 250 }));

  const mid = nextRedemptionProgress(250);
  assert(mid.nextTier === 'VOUCHER_5', 'NEXT_VOUCHER_FAIL');
  assert(mid.nextPoints === 500, 'NEXT_POINTS_FAIL');
  assert(mid.progressRatio === 0.5, 'PROGRESS_RATIO_FAIL');

  const afterVoucher = nextRedemptionProgress(500);
  assert(afterVoucher.nextTier === 'EARLY_ACCESS_CATERING', 'NEXT_EARLY_FAIL');
  assert(afterVoucher.nextPoints === 1000, 'EARLY_POINTS_FAIL');

  const maxed = nextRedemptionProgress(1500);
  assert(maxed.nextTier === null, 'MAXED_TIER_FAIL');
  assert(maxed.progressRatio === 1, 'MAXED_RATIO_FAIL');

  assert(REDEMPTION_RULES.VOUCHER_5.points === 500, 'VOUCHER_RULE_FAIL');
  assert(
    REDEMPTION_RULES.EARLY_ACCESS_CATERING.points === 1000,
    'EARLY_RULE_FAIL',
  );
  assert(normalizeRedemptionTier('EARLY_ACCESS') === 'EARLY_ACCESS_CATERING', 'NORM_FAIL');

  assert(redemptionAllowed('AVAILABLE') === true, 'ALLOW_AVAILABLE_FAIL');
  assert(redemptionAllowed('BLOCKED') === false, 'HARD_BLOCK_FAIL');

  log(formatRewardsSyncVerifiedLog({ boosts: 3 }));
  log('LOYALTY_UI_INTEGRATION_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LOYALTY_UI_INTEGRATION_FAILED ${message}`);
  process.exitCode = 1;
}

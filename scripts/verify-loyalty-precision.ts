/**
 * Precision Rewards verification.
 *
 * Usage:
 *   npm run test:loyalty:precision
 *
 * Success lines (uppercase, no emoji):
 *   REWARDS_LOGIC_PRECISION_SET
 *   LOYALTY_TICK_PROCESSED
 *   LOYALTY_PRECISION_VERIFIED
 */

import { RedemptionRulesService } from '../backend/src/modules/loyalty/redemption-rules.service';
import {
  LOYALTY_ACTION_POINTS,
  REDEMPTION_RULES,
  applyBoost,
  basePointsForAction,
  formatLoyaltyTickProcessedLog,
  formatRewardsLogicPrecisionSetLog,
  microFeeCents,
  normalizeLoyaltyAction,
  normalizeRedemptionTier,
} from '../backend/src/modules/loyalty/loyalty.util';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function log(message: string): void {
  console.log(message);
}

function main(): void {
  log(formatRewardsLogicPrecisionSetLog());

  assert(LOYALTY_ACTION_POINTS.RSVP_MARKET_EVENT === 10, 'RSVP_POINTS_FAIL');
  assert(LOYALTY_ACTION_POINTS.CATERING_INQUIRY === 50, 'CATERING_POINTS_FAIL');
  assert(
    LOYALTY_ACTION_POINTS.COLLABORATION_PURCHASE === 100,
    'COLLAB_POINTS_FAIL',
  );
  assert(basePointsForAction('RSVP_MARKET_EVENT') === 10, 'BASE_RSVP_FAIL');
  assert(normalizeLoyaltyAction('rsvp') === 'RSVP_MARKET_EVENT', 'NORM_RSVP_FAIL');
  assert(normalizeLoyaltyAction('catering') === 'CATERING_INQUIRY', 'NORM_CAT_FAIL');

  const boosted = applyBoost({ basePoints: 50, multiplier: 2 });
  assert(boosted.awarded === 100, 'BOOST_AWARD_FAIL');
  assert(boosted.bonus === 50, 'BOOST_BONUS_FAIL');
  assert(
    microFeeCents({ bonusPoints: 50, centsPerBonusPoint: 1 }) === 50,
    'MICRO_FEE_FAIL',
  );

  assert(REDEMPTION_RULES.VOUCHER_5.points === 500, 'VOUCHER_POINTS_FAIL');
  assert(
    REDEMPTION_RULES.EARLY_ACCESS_CATERING.points === 1000,
    'EARLY_POINTS_FAIL',
  );
  assert(normalizeRedemptionTier('500') === 'VOUCHER_5', 'TIER_500_FAIL');
  assert(
    normalizeRedemptionTier('EARLY_ACCESS') === 'EARLY_ACCESS_CATERING',
    'TIER_EARLY_FAIL',
  );

  const rules = new RedemptionRulesService();
  const tiers = rules.listTiers();
  assert(tiers.length === 2, 'TIERS_COUNT_FAIL');
  const quote = rules.quote('VOUCHER_5');
  assert(quote.pointsRequired === 500, 'QUOTE_POINTS_FAIL');
  assert(quote.voucherCents === 500, 'QUOTE_CENTS_FAIL');

  let affordFail = false;
  try {
    rules.assertAffordable(100, 'VOUCHER_5');
  } catch {
    affordFail = true;
  }
  assert(affordFail, 'AFFORD_SHOULD_FAIL');
  rules.assertAffordable(500, 'VOUCHER_5');

  log(
    formatLoyaltyTickProcessedLog({
      shopperId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      action: 'CATERING_INQUIRY',
      points: 100,
      boosted: true,
    }),
  );

  log('LOYALTY_PRECISION_VERIFIED');
}

try {
  main();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LOYALTY_PRECISION_FAILED ${message}`);
  process.exitCode = 1;
}

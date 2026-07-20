/**
 * Precision Rewards — reciprocal action points, boosts, redemption tiers.
 * Telemetry: REWARDS_LOGIC_PRECISION_SET, LOYALTY_TICK_PROCESSED
 */

export type LoyaltyActionType =
  | 'RSVP_MARKET_EVENT'
  | 'CATERING_INQUIRY'
  | 'COLLABORATION_PURCHASE'
  | 'REDEMPTION';

export type RedemptionTier = 'VOUCHER_5' | 'EARLY_ACCESS_CATERING';

/** Reciprocal action → base points. */
export const LOYALTY_ACTION_POINTS: Record<
  Exclude<LoyaltyActionType, 'REDEMPTION'>,
  number
> = {
  RSVP_MARKET_EVENT: 10,
  CATERING_INQUIRY: 50,
  COLLABORATION_PURCHASE: 100,
};

export const REDEMPTION_RULES: Record<
  RedemptionTier,
  { points: number; label: string; voucherCents: number | null }
> = {
  VOUCHER_5: {
    points: 500,
    label: '$5 VENDOR VOUCHER',
    voucherCents: 500,
  },
  EARLY_ACCESS_CATERING: {
    points: 1000,
    label: 'EARLY ACCESS CATERING SLOTS',
    voucherCents: null,
  },
};

export function formatRewardsLogicPrecisionSetLog(): string {
  return 'REWARDS_LOGIC_PRECISION_SET RSVP=10 CATERING=50 COLLAB=100';
}

export function formatLoyaltyTickProcessedLog(input: {
  shopperId: string;
  action: LoyaltyActionType;
  points: number;
  boosted?: boolean;
}): string {
  return `LOYALTY_TICK_PROCESSED SHOPPER=${input.shopperId} ACTION=${input.action} POINTS=${input.points} BOOSTED=${input.boosted ? '1' : '0'}`;
}

/** Phase 3 Shopper Loyalty UI telemetry (no emoji). */
export function formatLoyaltyUiActiveLog(input?: {
  pointsTotal?: number;
}): string {
  if (input?.pointsTotal != null) {
    return `LOYALTY_UI_ACTIVE POINTS=${input.pointsTotal}`;
  }
  return 'LOYALTY_UI_ACTIVE';
}

export function formatRewardsSyncVerifiedLog(input?: {
  boosts?: number;
}): string {
  if (input?.boosts != null) {
    return `REWARDS_SYNC_VERIFIED BOOSTS=${input.boosts}`;
  }
  return 'REWARDS_SYNC_VERIFIED';
}

/**
 * Next redemption tier progress from current points.
 * Returns the nearest unpaid tier (VOUCHER_5 then EARLY_ACCESS).
 */
export function nextRedemptionProgress(pointsTotal: number): {
  currentPoints: number;
  nextTier: RedemptionTier | null;
  nextPoints: number | null;
  progressRatio: number;
  label: string | null;
} {
  const points = Math.max(0, Math.floor(pointsTotal));
  const voucher = REDEMPTION_RULES.VOUCHER_5.points;
  const early = REDEMPTION_RULES.EARLY_ACCESS_CATERING.points;

  if (points < voucher) {
    return {
      currentPoints: points,
      nextTier: 'VOUCHER_5',
      nextPoints: voucher,
      progressRatio: Math.min(1, points / voucher),
      label: REDEMPTION_RULES.VOUCHER_5.label,
    };
  }
  if (points < early) {
    return {
      currentPoints: points,
      nextTier: 'EARLY_ACCESS_CATERING',
      nextPoints: early,
      progressRatio: Math.min(1, points / early),
      label: REDEMPTION_RULES.EARLY_ACCESS_CATERING.label,
    };
  }
  return {
    currentPoints: points,
    nextTier: null,
    nextPoints: null,
    progressRatio: 1,
    label: 'ALL TIERS UNLOCKED',
  };
}

export function basePointsForAction(action: LoyaltyActionType): number {
  if (action === 'REDEMPTION') return 0;
  return LOYALTY_ACTION_POINTS[action];
}

/**
 * Apply boost multiplier to base points.
 * Bonus = awarded - base. Micro-fee = bonus * centsPerBonusPoint.
 */
export function applyBoost(input: {
  basePoints: number;
  multiplier: number;
}): { awarded: number; bonus: number } {
  const multiplier = Math.max(1, input.multiplier);
  const awarded = Math.floor(input.basePoints * multiplier);
  return {
    awarded,
    bonus: Math.max(0, awarded - input.basePoints),
  };
}

export function microFeeCents(input: {
  bonusPoints: number;
  centsPerBonusPoint: number;
}): number {
  return Math.max(0, input.bonusPoints) * Math.max(0, input.centsPerBonusPoint);
}

export function normalizeRedemptionTier(
  value: string | null | undefined,
): RedemptionTier | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'VOUCHER_5' || upper === 'EARLY_ACCESS_CATERING') return upper;
  if (upper === 'VOUCHER' || upper === '500') return 'VOUCHER_5';
  if (upper === 'EARLY_ACCESS' || upper === '1000') return 'EARLY_ACCESS_CATERING';
  return null;
}

export function normalizeLoyaltyAction(
  value: string | null | undefined,
): Exclude<LoyaltyActionType, 'REDEMPTION'> | null {
  const upper = (value ?? '').trim().toUpperCase();
  if (upper === 'RSVP' || upper === 'RSVP_MARKET_EVENT') return 'RSVP_MARKET_EVENT';
  if (upper === 'CATERING' || upper === 'CATERING_INQUIRY') return 'CATERING_INQUIRY';
  if (
    upper === 'COLLAB' ||
    upper === 'COLLABORATION' ||
    upper === 'COLLABORATION_PURCHASE'
  ) {
    return 'COLLABORATION_PURCHASE';
  }
  return null;
}

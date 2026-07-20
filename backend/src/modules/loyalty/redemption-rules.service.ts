/**
 * Redemption rules for Precision Rewards tiers.
 * 500 points = $5 vendor voucher; 1000 = early catering access.
 */

import { BadRequestException, Injectable } from '@nestjs/common';

import {
  REDEMPTION_RULES,
  normalizeRedemptionTier,
  type RedemptionTier,
} from './loyalty.util';

export type RedemptionQuote = {
  tier: RedemptionTier;
  pointsRequired: number;
  label: string;
  voucherCents: number | null;
};

@Injectable()
export class RedemptionRulesService {
  listTiers(): RedemptionQuote[] {
    return (Object.keys(REDEMPTION_RULES) as RedemptionTier[]).map((tier) => {
      const rule = REDEMPTION_RULES[tier];
      return {
        tier,
        pointsRequired: rule.points,
        label: rule.label,
        voucherCents: rule.voucherCents,
      };
    });
  }

  quote(tierRaw: string): RedemptionQuote {
    const tier = normalizeRedemptionTier(tierRaw);
    if (!tier) throw new BadRequestException('REDEMPTION_TIER_INVALID');
    const rule = REDEMPTION_RULES[tier];
    return {
      tier,
      pointsRequired: rule.points,
      label: rule.label,
      voucherCents: rule.voucherCents,
    };
  }

  assertAffordable(pointsTotal: number, tier: RedemptionTier): void {
    const required = REDEMPTION_RULES[tier].points;
    if (pointsTotal < required) {
      throw new BadRequestException('INSUFFICIENT_LOYALTY_POINTS');
    }
  }
}

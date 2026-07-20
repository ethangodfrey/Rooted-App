/**
 * RedemptionService — apply Precision Rewards tiers with availability hard-block.
 * Telemetry: LOYALTY_UI_ACTIVE, REWARDS_SYNC_VERIFIED
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';

import { AvailabilityService } from '../availability/availability.service';
import {
  formatLoyaltyUiActiveLog,
  formatRewardsSyncVerifiedLog,
  normalizeRedemptionTier,
  type RedemptionTier,
} from './loyalty.util';
import { PrecisionRewardsService } from './precision-rewards.service';
import { RedemptionRulesService } from './redemption-rules.service';

@Injectable()
export class RedemptionService implements OnModuleInit {
  private readonly logger = new Logger(RedemptionService.name);

  constructor(
    private readonly rules: RedemptionRulesService,
    private readonly rewards: PrecisionRewardsService,
    private readonly availability: AvailabilityService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatLoyaltyUiActiveLog());
    this.logger.log(formatRewardsSyncVerifiedLog());
  }

  /**
   * Redeem a tier at a vendor for a catering inquiry date.
   * Hard-blocks when AvailabilityService returns BLOCKED for the date.
   */
  async redeemForInquiry(input: {
    userId: string;
    vendorId: string;
    tierRaw: string;
    eventDate: string | null | undefined;
  }) {
    const tier = normalizeRedemptionTier(input.tierRaw);
    if (!tier) throw new BadRequestException('REDEMPTION_TIER_INVALID');

    const dateRaw = (input.eventDate ?? '').trim();
    if (!dateRaw) {
      throw new BadRequestException('REDEMPTION_EVENT_DATE_REQUIRED');
    }

    const check = await this.availability.checkAvailability(
      input.vendorId,
      dateRaw,
    );
    if (check.BLOCKED) {
      this.logger.log(
        `REWARDS_SYNC_VERIFIED ACTION=REDEMPTION_HARD_BLOCKED VENDOR=${input.vendorId} DATE=${check.DATE}`,
      );
      throw new BadRequestException(
        `REDEMPTION_DATE_BLOCKED:${check.CONFLICT_WARNING ?? 'Conflict Detected'}`,
      );
    }

    const quote = this.rules.quote(tier);
    const result = await this.rewards.redeem({
      userId: input.userId,
      vendorId: input.vendorId,
      tierRaw: tier,
    });

    this.logger.log(
      formatRewardsSyncVerifiedLog({ boosts: 0 }),
    );
    this.logger.log(
      `LOYALTY_UI_ACTIVE ACTION=REDEEMED TIER=${tier} POINTS=${quote.pointsRequired}`,
    );

    return {
      ...result,
      STATUS: 'REWARDS_SYNC_VERIFIED',
      AVAILABILITY: check.STATUS,
      TIER: tier as RedemptionTier,
    };
  }
}

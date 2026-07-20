import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AvailabilityModule } from '../availability/availability.module';
import { LoyaltyController } from './loyalty.controller';
import { PrecisionRewardsService } from './precision-rewards.service';
import { RedemptionRulesService } from './redemption-rules.service';
import { RedemptionService } from './redemption.service';

@Module({
  imports: [PrismaModule, AvailabilityModule],
  controllers: [LoyaltyController],
  providers: [
    PrecisionRewardsService,
    RedemptionRulesService,
    RedemptionService,
  ],
  exports: [
    PrecisionRewardsService,
    RedemptionRulesService,
    RedemptionService,
  ],
})
export class LoyaltyModule {}

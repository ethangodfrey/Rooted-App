import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyController } from './loyalty.controller';
import { PrecisionRewardsService } from './precision-rewards.service';
import { RedemptionRulesService } from './redemption-rules.service';

@Module({
  imports: [PrismaModule],
  controllers: [LoyaltyController],
  providers: [PrecisionRewardsService, RedemptionRulesService],
  exports: [PrecisionRewardsService, RedemptionRulesService],
})
export class LoyaltyModule {}

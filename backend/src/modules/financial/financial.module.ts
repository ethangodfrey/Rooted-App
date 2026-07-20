import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { FinancialController } from './financial.controller';
import { PaymentClearingService } from './payment-clearing.service';

@Module({
  imports: [PrismaModule, LoyaltyModule],
  controllers: [FinancialController],
  providers: [PaymentClearingService],
  exports: [PaymentClearingService],
})
export class FinancialModule {}

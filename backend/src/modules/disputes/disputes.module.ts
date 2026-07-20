import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FinancialModule } from '../financial/financial.module';
import { StripeModule } from '../stripe/stripe.module';
import { DisputeService } from './dispute.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [PrismaModule, FinancialModule, StripeModule],
  controllers: [DisputesController],
  providers: [DisputeService],
  exports: [DisputeService],
})
export class DisputesModule {}

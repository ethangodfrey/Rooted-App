import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AvailabilityModule } from '../availability/availability.module';
import { FinancialModule } from '../financial/financial.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { VendorCateringController } from './vendor-catering.controller';
import { VendorCateringService } from './vendor-catering.service';

@Module({
  imports: [PrismaModule, AvailabilityModule, LoyaltyModule, FinancialModule],
  controllers: [VendorCateringController],
  providers: [VendorCateringService],
  exports: [VendorCateringService],
})
export class CateringModule {}

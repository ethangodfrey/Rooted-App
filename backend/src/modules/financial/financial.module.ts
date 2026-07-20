import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { FinancialController } from './financial.controller';
import { GenerateInvoiceService } from './generate-invoice.service';
import { PaymentClearingService } from './payment-clearing.service';

@Module({
  imports: [PrismaModule, LoyaltyModule],
  controllers: [FinancialController],
  providers: [PaymentClearingService, GenerateInvoiceService],
  exports: [PaymentClearingService, GenerateInvoiceService],
})
export class FinancialModule {}

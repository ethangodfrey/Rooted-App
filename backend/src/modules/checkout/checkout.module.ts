import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryLedgerModule } from '../inventory/inventory-ledger.module';
import { StripeModule } from '../stripe/stripe.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [PrismaModule, InventoryLedgerModule, StripeModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}

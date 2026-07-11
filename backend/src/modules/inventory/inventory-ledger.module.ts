import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { CheckoutInventoryService } from '../checkout/checkout-inventory.service';

@Module({
  imports: [PrismaModule],
  providers: [CheckoutInventoryService],
  exports: [CheckoutInventoryService],
})
export class InventoryLedgerModule {}

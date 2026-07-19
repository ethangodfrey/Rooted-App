import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { VendorConnectionsController } from './vendor-connections.controller';
import { VendorConnectionsService } from './vendor-connections.service';
import { WholesaleInvoicesController } from './wholesale-invoices.controller';
import { WholesaleOrdersController } from './wholesale-orders.controller';
import { WholesaleOrdersService } from './wholesale-orders.service';
import { WholesaleProductsController } from './wholesale-products.controller';
import { WholesaleProductsService } from './wholesale-products.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    VendorConnectionsController,
    WholesaleProductsController,
    WholesaleOrdersController,
    WholesaleInvoicesController,
  ],
  providers: [
    VendorConnectionsService,
    WholesaleProductsService,
    WholesaleOrdersService,
  ],
  exports: [
    VendorConnectionsService,
    WholesaleProductsService,
    WholesaleOrdersService,
  ],
})
export class B2bModule {}

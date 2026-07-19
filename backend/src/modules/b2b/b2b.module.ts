import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { StripeModule } from '../stripe/stripe.module';
import { VendorConnectionsController } from './vendor-connections.controller';
import { VendorConnectionsService } from './vendor-connections.service';
import { WholesaleInvoiceOverdueScheduler } from './wholesale-invoice-overdue.scheduler';
import { WholesaleInvoiceOverdueService } from './wholesale-invoice-overdue.service';
import { WholesaleInvoicesController } from './wholesale-invoices.controller';
import { WholesaleOrdersController } from './wholesale-orders.controller';
import { WholesaleOrdersService } from './wholesale-orders.service';
import { WholesaleProductsController } from './wholesale-products.controller';
import { WholesaleProductsService } from './wholesale-products.service';

@Module({
  imports: [PrismaModule, StripeModule],
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
    WholesaleInvoiceOverdueService,
    WholesaleInvoiceOverdueScheduler,
  ],
  exports: [
    VendorConnectionsService,
    WholesaleProductsService,
    WholesaleOrdersService,
    WholesaleInvoiceOverdueService,
  ],
})
export class B2bModule {}

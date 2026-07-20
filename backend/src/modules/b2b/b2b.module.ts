import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ElasticsearchModule } from '../search/elasticsearch.module';
import { UsWholesaleProximityMiddleware } from '../search/us-wholesale-proximity.middleware';
import { StripeModule } from '../stripe/stripe.module';
import { VendorConnectionsController } from './vendor-connections.controller';
import { VendorConnectionsService } from './vendor-connections.service';
import { VendorPeerRequestsController } from './vendor-peer-requests.controller';
import { VendorPeerRequestsService } from './vendor-peer-requests.service';
import { WholesaleInvoiceOverdueScheduler } from './wholesale-invoice-overdue.scheduler';
import { WholesaleInvoiceOverdueService } from './wholesale-invoice-overdue.service';
import { WholesaleInvoicesController } from './wholesale-invoices.controller';
import { WholesaleOrdersController } from './wholesale-orders.controller';
import { WholesaleOrdersService } from './wholesale-orders.service';
import { WholesaleProductsController } from './wholesale-products.controller';
import { WholesaleProductsService } from './wholesale-products.service';
import { WholesaleRelationshipMiddleware } from './wholesale-relationship.middleware';

@Module({
  imports: [PrismaModule, StripeModule, ElasticsearchModule],
  controllers: [
    VendorConnectionsController,
    VendorPeerRequestsController,
    WholesaleProductsController,
    WholesaleOrdersController,
    WholesaleInvoicesController,
  ],
  providers: [
    VendorConnectionsService,
    VendorPeerRequestsService,
    WholesaleProductsService,
    WholesaleOrdersService,
    WholesaleInvoiceOverdueService,
    WholesaleInvoiceOverdueScheduler,
    UsWholesaleProximityMiddleware,
    WholesaleRelationshipMiddleware,
  ],
  exports: [
    VendorConnectionsService,
    VendorPeerRequestsService,
    WholesaleProductsService,
    WholesaleOrdersService,
    WholesaleInvoiceOverdueService,
  ],
})
export class B2bModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(UsWholesaleProximityMiddleware)
      .forRoutes({
        path: 'api/vendors/wholesale-products/search',
        method: RequestMethod.GET,
      });
    consumer
      .apply(WholesaleRelationshipMiddleware)
      .forRoutes({
        path: 'api/vendors/orders/drafts',
        method: RequestMethod.POST,
      });
  }
}

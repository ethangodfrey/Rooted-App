import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FinancialModule } from '../financial/financial.module';
import { ElasticsearchModule } from '../search/elasticsearch.module';
import { UsWholesaleProximityMiddleware } from '../search/us-wholesale-proximity.middleware';
import { StripeModule } from '../stripe/stripe.module';
import { B2bMarketplaceController } from './b2b-marketplace.controller';
import { B2bMarketplaceService } from './b2b-marketplace.service';
import { CatalogBulkImportController } from './catalog-bulk-import.controller';
import { CatalogBulkImportService } from './catalog-bulk-import.service';
import { ChefProcurementController } from './chef-procurement.controller';
import { ChefProcurementService } from './chef-procurement.service';
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
  imports: [PrismaModule, StripeModule, FinancialModule, ElasticsearchModule],
  controllers: [
    VendorConnectionsController,
    VendorPeerRequestsController,
    WholesaleProductsController,
    WholesaleOrdersController,
    WholesaleInvoicesController,
    B2bMarketplaceController,
    CatalogBulkImportController,
    ChefProcurementController,
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
    B2bMarketplaceService,
    CatalogBulkImportService,
    ChefProcurementService,
  ],
  exports: [
    VendorConnectionsService,
    VendorPeerRequestsService,
    WholesaleProductsService,
    WholesaleOrdersService,
    WholesaleInvoiceOverdueService,
    B2bMarketplaceService,
    CatalogBulkImportService,
    ChefProcurementService,
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

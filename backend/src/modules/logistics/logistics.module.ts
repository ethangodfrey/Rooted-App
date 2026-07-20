import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FinancialModule } from '../financial/financial.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LogisticsFulfillmentController } from './logistics-fulfillment.controller';
import { LogisticsFulfillmentService } from './logistics-fulfillment.service';
import { LogisticsShippingController } from './logistics-shipping.controller';
import { LogisticsService } from './logistics.service';
import { RegionalFreightCarrierClient } from './regional-freight-carrier.client';
import { UsLogisticsRouteMiddleware } from './us-logistics-route.middleware';

@Module({
  imports: [PrismaModule, FinancialModule, NotificationsModule],
  controllers: [LogisticsShippingController, LogisticsFulfillmentController],
  providers: [
    LogisticsService,
    LogisticsFulfillmentService,
    RegionalFreightCarrierClient,
    UsLogisticsRouteMiddleware,
  ],
  exports: [
    LogisticsService,
    LogisticsFulfillmentService,
    RegionalFreightCarrierClient,
  ],
})
export class LogisticsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(UsLogisticsRouteMiddleware).forRoutes({
      path: 'api/orders/:orderId/shipping-options',
      method: RequestMethod.GET,
    });
  }
}

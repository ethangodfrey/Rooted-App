import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { LogisticsShippingController } from './logistics-shipping.controller';
import { LogisticsService } from './logistics.service';
import { RegionalFreightCarrierClient } from './regional-freight-carrier.client';
import { UsLogisticsRouteMiddleware } from './us-logistics-route.middleware';

@Module({
  imports: [PrismaModule],
  controllers: [LogisticsShippingController],
  providers: [
    LogisticsService,
    RegionalFreightCarrierClient,
    UsLogisticsRouteMiddleware,
  ],
  exports: [LogisticsService, RegionalFreightCarrierClient],
})
export class LogisticsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(UsLogisticsRouteMiddleware).forRoutes({
      path: 'api/orders/:orderId/shipping-options',
      method: RequestMethod.GET,
    });
  }
}

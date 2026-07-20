import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DemandForecastService } from './demand-forecast.service';
import { SupplierAnalyticsController } from './supplier-analytics.controller';
import { SupplierArAnalyticsService } from './supplier-ar-analytics.service';
import { VendorAlertsService } from './vendor-alerts.service';
import { VendorLowStockScheduler } from './vendor-low-stock.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [SupplierAnalyticsController],
  providers: [
    DemandForecastService,
    SupplierArAnalyticsService,
    VendorAlertsService,
    VendorLowStockScheduler,
  ],
  exports: [DemandForecastService, VendorAlertsService, SupplierArAnalyticsService],
})
export class SupplierAnalyticsModule {}

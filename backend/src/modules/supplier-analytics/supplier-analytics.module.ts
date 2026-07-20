import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DemandForecastService } from './demand-forecast.service';
import { VendorAlertsService } from './vendor-alerts.service';
import { VendorLowStockScheduler } from './vendor-low-stock.scheduler';

@Module({
  imports: [PrismaModule],
  providers: [DemandForecastService, VendorAlertsService, VendorLowStockScheduler],
  exports: [DemandForecastService, VendorAlertsService],
})
export class SupplierAnalyticsModule {}

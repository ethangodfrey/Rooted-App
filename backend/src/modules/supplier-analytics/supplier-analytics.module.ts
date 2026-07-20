import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { DemandForecastService } from './demand-forecast.service';

@Module({
  imports: [PrismaModule],
  providers: [DemandForecastService],
  exports: [DemandForecastService],
})
export class SupplierAnalyticsModule {}

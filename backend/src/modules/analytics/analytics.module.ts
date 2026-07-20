import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsReportingService } from './analytics-reporting.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsReportingService],
  exports: [AnalyticsReportingService],
})
export class AnalyticsModule {}

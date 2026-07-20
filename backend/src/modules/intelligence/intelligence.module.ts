import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { IntelligenceController } from './intelligence.controller';
import { PartnerNotifyService } from './partner-notify.service';
import { PartnerReportService } from './partner-report.service';
import { PerformanceMonitorScheduler } from './performance-monitor.scheduler';
import { PerformanceMonitorService } from './performance-monitor.service';
import { WeeklyPerformanceReporter } from './weekly-performance-reporter';

@Module({
  imports: [PrismaModule],
  controllers: [IntelligenceController],
  providers: [
    PartnerNotifyService,
    PartnerReportService,
    PerformanceMonitorService,
    WeeklyPerformanceReporter,
    PerformanceMonitorScheduler,
  ],
  exports: [PartnerReportService, PerformanceMonitorService],
})
export class IntelligenceModule {}

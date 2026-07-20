import {
  Controller,
  Get,
  Logger,
  OnModuleInit,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, Roles } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  formatAnomalyDetectionActiveLog,
  formatReportingEngineInitializedLog,
} from './intelligence.util';
import { PartnerReportService } from './partner-report.service';
import { PerformanceMonitorService } from './performance-monitor.service';

@Controller('api/intelligence')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class IntelligenceController implements OnModuleInit {
  private readonly logger = new Logger(IntelligenceController.name);

  constructor(
    private readonly reports: PartnerReportService,
    private readonly monitor: PerformanceMonitorService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatReportingEngineInitializedLog());
    this.logger.log(formatAnomalyDetectionActiveLog());
  }

  @Get('reports')
  @Roles('vendor', 'farmer', 'admin')
  async listReports(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limitRaw?: string,
  ) {
    const limit =
      limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 20;
    const items = await this.reports.listRecentReports(
      user.id,
      Number.isFinite(limit) ? limit : 20,
    );
    return {
      STATUS: 'REPORTING_ENGINE_INITIALIZED',
      ITEMS: items,
      COUNT: items.length,
    };
  }

  /** Manual trigger for ops / admin smoke (also used by verify scripts conceptually). */
  @Post('reports/run-weekly')
  @Roles('admin')
  async runWeekly() {
    return this.reports.runWeeklyReports(new Date());
  }

  @Post('anomalies/scan')
  @Roles('admin')
  async scanAnomalies() {
    return this.monitor.scanAllPartners();
  }
}

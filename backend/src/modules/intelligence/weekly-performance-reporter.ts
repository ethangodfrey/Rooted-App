import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { formatReportingEngineInitializedLog } from './intelligence.util';
import { PartnerReportService } from './partner-report.service';

/**
 * Weekly performance reporter — Mondays 08:00 server time.
 * Gate: WEEKLY_PERFORMANCE_REPORT_CRON_ENABLED (default true).
 * Telemetry: REPORTING_ENGINE_INITIALIZED
 */
@Injectable()
export class WeeklyPerformanceReporter implements OnModuleInit {
  private readonly logger = new Logger(WeeklyPerformanceReporter.name);
  private readonly cronEnabled: boolean;
  private inFlight = false;

  constructor(
    private readonly reports: PartnerReportService,
    private readonly config: ConfigService,
  ) {
    this.cronEnabled =
      this.config
        .get<string>('WEEKLY_PERFORMANCE_REPORT_CRON_ENABLED', 'true')
        .toLowerCase() === 'true';
  }

  onModuleInit(): void {
    this.logger.log(
      `${formatReportingEngineInitializedLog()} CRON=0_8_*_*_1 ENABLED=${this.cronEnabled ? '1' : '0'}`,
    );
  }

  /** Mondays at 08:00 — summarize prior Mon–Sun engagement week. */
  @Cron('0 8 * * 1')
  async handleMondayMorningReport(): Promise<void> {
    if (!this.cronEnabled) {
      this.logger.log('REPORTING_ENGINE_INITIALIZED ACTION=CRON_SKIPPED_DISABLED');
      return;
    }
    if (this.inFlight) {
      this.logger.log('REPORTING_ENGINE_INITIALIZED ACTION=CRON_SKIPPED_LOCK');
      return;
    }

    this.inFlight = true;
    try {
      await this.reports.runWeeklyReports(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `REPORTING_ENGINE_INITIALIZED ACTION=CRON_FAILED ERROR=${message}`,
      );
    } finally {
      this.inFlight = false;
    }
  }
}

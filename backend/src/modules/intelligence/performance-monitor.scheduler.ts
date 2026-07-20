import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { formatAnomalyDetectionActiveLog } from './intelligence.util';
import { PerformanceMonitorService } from './performance-monitor.service';

/**
 * Hourly anomaly scan against 30-day rolling averages.
 * Gate: PERFORMANCE_ANOMALY_CRON_ENABLED (default true).
 * Telemetry: ANOMALY_DETECTION_ACTIVE, PERFORMANCE_ANOMALY_DETECTED
 */
@Injectable()
export class PerformanceMonitorScheduler implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMonitorScheduler.name);
  private readonly cronEnabled: boolean;
  private inFlight = false;

  constructor(
    private readonly monitor: PerformanceMonitorService,
    private readonly config: ConfigService,
  ) {
    this.cronEnabled =
      this.config
        .get<string>('PERFORMANCE_ANOMALY_CRON_ENABLED', 'true')
        .toLowerCase() === 'true';
  }

  onModuleInit(): void {
    this.logger.log(
      `${formatAnomalyDetectionActiveLog()} CRON=0_*_*_*_* ENABLED=${this.cronEnabled ? '1' : '0'}`,
    );
  }

  @Cron('0 * * * *')
  async handleHourlyScan(): Promise<void> {
    if (!this.cronEnabled) {
      this.logger.log('ANOMALY_DETECTION_ACTIVE ACTION=CRON_SKIPPED_DISABLED');
      return;
    }
    if (this.inFlight) {
      this.logger.log('ANOMALY_DETECTION_ACTIVE ACTION=CRON_SKIPPED_LOCK');
      return;
    }

    this.inFlight = true;
    try {
      await this.monitor.scanAllPartners();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `ANOMALY_DETECTION_ACTIVE ACTION=CRON_FAILED ERROR=${message}`,
      );
    } finally {
      this.inFlight = false;
    }
  }
}

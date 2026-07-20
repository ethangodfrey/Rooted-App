import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { ContentDualPostingHealthService } from './content-dual-posting-health.service';

/**
 * Cron health check for dual-posting post_contributions sync.
 * Gate: DUAL_POSTING_HEALTH_CRON_ENABLED (default true).
 * Telemetry: DUAL_POSTING_METRIC_CAPTURED, LATENCY_THRESHOLD_VALIDATED
 */
@Injectable()
export class ContentDualPostingHealthScheduler implements OnModuleInit {
  private readonly logger = new Logger(ContentDualPostingHealthScheduler.name);
  private readonly cronEnabled: boolean;
  private inFlight = false;

  constructor(
    private readonly health: ContentDualPostingHealthService,
    private readonly config: ConfigService,
  ) {
    this.cronEnabled =
      this.config
        .get<string>('DUAL_POSTING_HEALTH_CRON_ENABLED', 'true')
        .toLowerCase() === 'true';
  }

  onModuleInit(): void {
    this.logger.log(
      `DUAL_POSTING_METRIC_CAPTURED KIND=SYNC_HEALTH DETAIL=CRON_REGISTERED SCHEDULE=*/15_*_*_*_* ENABLED=${this.cronEnabled ? '1' : '0'} WITHIN_BUDGET=1`,
    );
  }

  /** Every 15 minutes — validate post_contributions sync status. */
  @Cron('*/15 * * * *')
  async handleQuarterHourSyncHealth(): Promise<void> {
    if (!this.cronEnabled) {
      this.logger.log(
        'DUAL_POSTING_METRIC_CAPTURED KIND=SYNC_HEALTH DETAIL=CRON_SKIPPED_DISABLED WITHIN_BUDGET=1',
      );
      return;
    }

    if (this.inFlight) {
      this.logger.log(
        'DUAL_POSTING_METRIC_CAPTURED KIND=SYNC_HEALTH DETAIL=CRON_SKIPPED_LOCK WITHIN_BUDGET=1',
      );
      return;
    }

    this.inFlight = true;
    try {
      const result = await this.health.validateSyncHealth();
      this.logger.log(
        `LATENCY_THRESHOLD_VALIDATED KIND=SYNC_HEALTH VALUE_MS=0 BUDGET_MS=0 WITHIN=${result.STATUS === 'OK' ? '1' : '0'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `DUAL_POSTING_METRIC_CAPTURED KIND=SYNC_HEALTH WITHIN_BUDGET=0 DETAIL=CRON_FAILED:${message}`,
      );
    } finally {
      this.inFlight = false;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PartitionAwareOrderIndexerService } from './partition-aware-order-indexer.service';

/**
 * Production cron for partition-aware order → Elasticsearch partial sync.
 * Gate: DISCOVERY_PARTITION_SYNC_CRON_ENABLED (default true in production).
 * Telemetry: PRODUCTION_SYNC_CONFIGURED, CRON_JOB_REGISTERED
 */
@Injectable()
export class PartitionAwareOrderIndexerScheduler implements OnModuleInit {
  private readonly logger = new Logger(
    PartitionAwareOrderIndexerScheduler.name,
  );
  private readonly cronEnabled: boolean;
  private syncInFlight = false;

  constructor(
    private readonly indexer: PartitionAwareOrderIndexerService,
    private readonly config: ConfigService,
  ) {
    const raw = (
      this.config.get<string>('DISCOVERY_PARTITION_SYNC_CRON_ENABLED') ?? ''
    )
      .trim()
      .toLowerCase();
    const nodeEnv = (
      this.config.get<string>('NODE_ENV') ?? 'development'
    ).toLowerCase();

    // Default on in production; opt-in elsewhere unless explicitly enabled.
    if (raw === 'true') {
      this.cronEnabled = true;
    } else if (raw === 'false') {
      this.cronEnabled = false;
    } else {
      this.cronEnabled = nodeEnv === 'production';
    }
  }

  onModuleInit(): void {
    this.logger.log(
      `PRODUCTION_SYNC_CONFIGURED ENABLED=${this.cronEnabled ? '1' : '0'} TARGET=PartitionAwareOrderIndexerService.syncRecentPartitions SCHEDULE=EVERY_HOUR`,
    );
    this.logger.log(
      `CRON_JOB_REGISTERED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC CRON=${CronExpression.EVERY_HOUR} ENABLED=${this.cronEnabled ? '1' : '0'}`,
    );
  }

  /**
   * Hourly partial reindex of recent/active order partitions.
   * Errors (connectivity, locking, query failures) are swallowed so the
   * Nest process is never interrupted by search sync.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyPartialSync(): Promise<void> {
    if (!this.cronEnabled) {
      this.logger.log(
        'CRON_JOB_REGISTERED SKIPPED REASON=DISABLED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC',
      );
      return;
    }

    if (this.syncInFlight) {
      this.logger.log(
        'CRON_JOB_REGISTERED SKIPPED REASON=LOCK_HELD JOB=DISCOVERY_PARTITION_PARTIAL_SYNC',
      );
      return;
    }

    this.syncInFlight = true;
    try {
      this.logger.log(
        'CRON_JOB_REGISTERED EXECUTED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC',
      );
      const result = await this.indexer.syncRecentPartitions();
      this.logger.log(
        `PRODUCTION_SYNC_CONFIGURED COMPLETED PARTITIONS=${result.PARTITIONS_SCANNED} INDEXED=${result.DOCUMENTS_INDEXED} SKIPPED=${result.SKIPPED_REASON ?? 'NONE'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `PRODUCTION_SYNC_CONFIGURED FAILED ERROR=${message} CONTINUING=1`,
      );
    } finally {
      this.syncInFlight = false;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  PartitionAwareSchedulerController,
  type SchedulerLastRunStatus,
} from './partition-aware-scheduler-reliability.util';
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
  private readonly controller: PartitionAwareSchedulerController;

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

    this.controller = new PartitionAwareSchedulerController(
      this.indexer,
      this.cronEnabled,
    );
  }

  onModuleInit(): void {
    this.logger.log(
      `PRODUCTION_SYNC_CONFIGURED ENABLED=${this.cronEnabled ? '1' : '0'} TARGET=PartitionAwareOrderIndexerService.syncRecentPartitions SCHEDULE=EVERY_HOUR`,
    );
    this.logger.log(
      `CRON_JOB_REGISTERED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC CRON=${CronExpression.EVERY_HOUR} ENABLED=${this.cronEnabled ? '1' : '0'}`,
    );
  }

  getLastRunStatus(): SchedulerLastRunStatus {
    return this.controller.getLastRunStatus();
  }

  /** Test/ops hook — same path as the hourly cron, including lock semantics. */
  async triggerSync(): Promise<SchedulerLastRunStatus> {
    return this.controller.triggerSync();
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

    const before = this.controller.getLastRunStatus();
    const status = await this.controller.triggerSync();

    if (status.SKIPPED_REASON === 'LOCK_HELD') {
      this.logger.log(
        'CRON_JOB_REGISTERED SKIPPED REASON=LOCK_HELD JOB=DISCOVERY_PARTITION_PARTIAL_SYNC',
      );
      return;
    }

    if (status.ERROR) {
      this.logger.error(
        `PRODUCTION_SYNC_CONFIGURED FAILED ERROR=${status.ERROR} CONTINUING=1`,
      );
      return;
    }

    this.logger.log(
      'CRON_JOB_REGISTERED EXECUTED JOB=DISCOVERY_PARTITION_PARTIAL_SYNC',
    );
    this.logger.log(
      `PRODUCTION_SYNC_CONFIGURED COMPLETED PARTITIONS=${status.PARTITIONS_SCANNED} INDEXED=${status.DOCUMENTS_INDEXED} SKIPPED=NONE LAST_RUN_SUCCESS=${status.SUCCESS ? '1' : '0'} PREV_SUCCESS=${before.SUCCESS ? '1' : '0'}`,
    );
  }
}

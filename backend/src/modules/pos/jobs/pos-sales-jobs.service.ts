import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type Job } from 'bullmq';

import { isPosQueuesEnabled } from '../../../common/redis/pos-queues-enabled';
import { PosSalesIngestService } from '../services/pos-sales-ingest.service';
import { PosSnapshotRollupService } from '../services/pos-snapshot-rollup.service';
import { mergeTenderBreakdown } from '../utils/tender-aggregation';
import {
  POS_SALES_INGEST_JOB,
  POS_SALES_INGEST_QUEUE,
  POS_SNAPSHOT_ROLLUP_JOB,
  POS_SNAPSHOT_ROLLUP_QUEUE,
  SNAPSHOT_ROLLUP_DEBOUNCE_MS,
  salesIngestJobId,
  snapshotRollupJobId,
} from './pos-sales-queue.constants';
import type { PosSalesIngestJobData, PosSnapshotRollupJobData } from '../types/ledger-transaction';

@Injectable()
export class PosSalesJobsService {
  private readonly logger = new Logger(PosSalesJobsService.name);
  private readonly queuesEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly ingestService: PosSalesIngestService,
    private readonly rollupService: PosSnapshotRollupService,
    @Optional() @InjectQueue(POS_SALES_INGEST_QUEUE) private readonly salesQueue: Queue | null,
    @Optional() @InjectQueue(POS_SNAPSHOT_ROLLUP_QUEUE) private readonly rollupQueue: Queue | null,
  ) {
    this.queuesEnabled = isPosQueuesEnabled(config);
    if (!this.queuesEnabled) {
      this.logger.warn(
        'POS sales ingest queue disabled — jobs run inline (set POS_QUEUES_ENABLED=true + Redis for production workers).',
      );
    }
  }

  enqueueSalesIngest(data: PosSalesIngestJobData): Promise<Job<PosSalesIngestJobData>> {
    if (!this.queuesEnabled || !this.salesQueue) {
      void this.runInlineIngest(data).catch((err: Error) => {
        this.logger.error(`Inline POS sales ingest failed: ${err.message}`);
      });
      return Promise.resolve({ id: `${data.provider}:${data.providerEventId}` } as Job<PosSalesIngestJobData>);
    }

    const jobId = salesIngestJobId(data.provider, data.providerEventId);
    return this.salesQueue.add(POS_SALES_INGEST_JOB, data, { jobId });
  }

  async enqueueSnapshotRollup(data: PosSnapshotRollupJobData): Promise<Job<PosSnapshotRollupJobData> | null> {
    if (!this.queuesEnabled || !this.rollupQueue) {
      void this.rollupService.rollupVendorMarketDay(data).catch((err: Error) => {
        this.logger.error(`Inline POS snapshot rollup failed: ${err.message}`);
      });
      return Promise.resolve({ id: snapshotRollupJobId(data.vendorId, data.marketId, data.snapshotDate) } as Job<PosSnapshotRollupJobData>);
    }

    const jobId = snapshotRollupJobId(data.vendorId, data.marketId, data.snapshotDate);
    const options = {
      jobId,
      delay: SNAPSHOT_ROLLUP_DEBOUNCE_MS,
      removeOnComplete: { age: 3_600, count: 5_000 },
      removeOnFail: { age: 604_800 },
      attempts: 5,
      backoff: { type: 'exponential' as const, delay: 2_000 },
    };

    try {
      return await this.rollupQueue.add(POS_SNAPSHOT_ROLLUP_JOB, data, options);
    } catch (err) {
      const message = (err as Error).message?.toLowerCase() ?? '';
      if (!message.includes('job') || !message.includes('exist')) {
        throw err;
      }

      const existing = await this.rollupQueue.getJob(jobId);
      if (!existing) {
        return null;
      }

      const merged: PosSnapshotRollupJobData = {
        ...existing.data,
        tenantId: data.tenantId ?? existing.data.tenantId,
        posConnectionId: data.posConnectionId ?? existing.data.posConnectionId,
        tenderBreakdown: mergeTenderBreakdown(
          existing.data.tenderBreakdown,
          data.tenderBreakdown,
        ),
      };
      await existing.updateData(merged);
      this.logger.debug(`Merged debounced rollup job ${jobId}`);
      return existing as Job<PosSnapshotRollupJobData>;
    }
  }

  private async runInlineIngest(data: PosSalesIngestJobData): Promise<void> {
    const result = await this.ingestService.ingest(data);
    for (const rollup of result.rollups) {
      await this.enqueueSnapshotRollup(rollup);
    }
  }
}

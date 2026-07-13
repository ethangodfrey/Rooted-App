/**
 * BullMQ consumer for debounced market_sales_snapshots rollups.
 * Registered only when POS_QUEUES_ENABLED=true (see pos.module.ts).
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  POS_SNAPSHOT_ROLLUP_JOB,
  POS_SNAPSHOT_ROLLUP_QUEUE,
} from '../jobs/pos-sales-queue.constants';
import { PosSnapshotRollupService } from '../services/pos-snapshot-rollup.service';
import type { PosSnapshotRollupJobData } from '../types/ledger-transaction';

@Processor(POS_SNAPSHOT_ROLLUP_QUEUE, { concurrency: 5 })
export class PosSnapshotRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(PosSnapshotRollupProcessor.name);

  constructor(private readonly rollupService: PosSnapshotRollupService) {
    super();
  }

  async process(job: Job<PosSnapshotRollupJobData>): Promise<void> {
    if (job.name !== POS_SNAPSHOT_ROLLUP_JOB) {
      this.logger.warn(`Ignoring unknown job name "${job.name}" on ${POS_SNAPSHOT_ROLLUP_QUEUE}`);
      return;
    }

    const { vendorId, marketId, snapshotDate } = job.data;
    if (!vendorId || !marketId || !snapshotDate) {
      throw new Error(
        `Invalid PosSnapshotRollupJobData: vendorId, marketId, and snapshotDate are required (job=${job.id})`,
      );
    }

    this.logger.debug(
      `pos-snapshot-rollup start job=${job.id} vendor=${vendorId} market=${marketId} date=${snapshotDate}`,
    );

    try {
      const snapshotId = await this.rollupService.rollupVendorMarketDay(job.data);
      this.logger.log(
        `pos-snapshot-rollup complete job=${job.id} vendor=${vendorId} market=${marketId} date=${snapshotDate} snapshot=${snapshotId ?? 'none'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `pos-snapshot-rollup failed job=${job.id} vendor=${vendorId} market=${marketId} date=${snapshotDate}: ${message}`,
      );
      throw err;
    }
  }
}

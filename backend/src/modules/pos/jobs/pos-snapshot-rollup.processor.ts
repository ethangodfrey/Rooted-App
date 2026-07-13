/**
 * Debounced consumer for upsert_market_sales_snapshot RPC + tender mix patch.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  POS_SNAPSHOT_ROLLUP_JOB,
  POS_SNAPSHOT_ROLLUP_QUEUE,
} from './pos-sales-queue.constants';
import { PosSnapshotRollupService } from '../services/pos-snapshot-rollup.service';
import type { PosSnapshotRollupJobData } from '../types/ledger-transaction';

@Processor(POS_SNAPSHOT_ROLLUP_QUEUE, { concurrency: 5 })
export class PosSnapshotRollupProcessor extends WorkerHost {
  private readonly logger = new Logger(PosSnapshotRollupProcessor.name);

  constructor(private readonly rollup: PosSnapshotRollupService) {
    super();
  }

  async process(job: Job<PosSnapshotRollupJobData>): Promise<void> {
    if (job.name !== POS_SNAPSHOT_ROLLUP_JOB) return;

    const snapshotId = await this.rollup.rollupVendorMarketDay(job.data);
    this.logger.log(
      `pos-snapshot-rollup vendor=${job.data.vendorId} market=${job.data.marketId} date=${job.data.snapshotDate} snapshot=${snapshotId ?? 'none'}`,
    );
  }
}

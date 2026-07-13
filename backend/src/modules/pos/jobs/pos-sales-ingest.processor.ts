/**
 * Consumes pos-sales-ingest queue → pos_transactions ledger writes + rollup scheduling.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { POS_SALES_INGEST_JOB, POS_SALES_INGEST_QUEUE } from './pos-sales-queue.constants';
import { PosSalesJobsService } from './pos-sales-jobs.service';
import { PosSalesIngestService } from '../services/pos-sales-ingest.service';
import type { PosSalesIngestJobData } from '../types/ledger-transaction';

@Processor(POS_SALES_INGEST_QUEUE, { concurrency: 10 })
export class PosSalesIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(PosSalesIngestProcessor.name);

  constructor(
    private readonly ingestService: PosSalesIngestService,
    private readonly salesJobs: PosSalesJobsService,
  ) {
    super();
  }

  async process(job: Job<PosSalesIngestJobData>): Promise<void> {
    if (job.name !== POS_SALES_INGEST_JOB) return;

    const result = await this.ingestService.ingest(job.data);
    for (const rollup of result.rollups) {
      await this.salesJobs.enqueueSnapshotRollup(rollup);
    }

    this.logger.log(
      `pos-sales-ingest ${job.data.provider} event=${job.data.providerEventId} wrote=${result.written} rollups=${result.rollups.length}`,
    );
  }
}

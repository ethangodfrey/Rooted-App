import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PosAnalyticsService } from '../services/pos-analytics.service';
import {
  POS_AGGREGATION_QUEUE,
  POS_JOBS,
  type AggregateVendorJobData,
} from './pos-queue.constants';

@Processor(POS_AGGREGATION_QUEUE, { concurrency: 3 })
export class PosAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(PosAggregationProcessor.name);

  constructor(private readonly analytics: PosAnalyticsService) {
    super();
  }

  async process(job: Job<AggregateVendorJobData>): Promise<void> {
    if (job.name !== POS_JOBS.AGGREGATE_VENDOR) {
      this.logger.warn(`Unknown job ${job.name} on ${POS_AGGREGATION_QUEUE}`);
      return;
    }
    await this.analytics.recomputeSnapshots(job.data.vendorId, job.data.dates);
  }
}

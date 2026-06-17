import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { PosSyncService } from '../services/pos-sync.service';
import { POS_JOBS, POS_SYNC_QUEUE, type SyncConnectionJobData } from './pos-queue.constants';

/**
 * Worker for the POS sync queue. BullMQ retries failed jobs per the default job
 * options (exponential backoff) configured in AppModule.
 */
@Processor(POS_SYNC_QUEUE, { concurrency: 5 })
export class PosSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(PosSyncProcessor.name);

  constructor(private readonly sync: PosSyncService) {
    super();
  }

  async process(job: Job<SyncConnectionJobData>): Promise<void> {
    if (job.name !== POS_JOBS.SYNC_CONNECTION) {
      this.logger.warn(`Unknown job ${job.name} on ${POS_SYNC_QUEUE}`);
      return;
    }
    this.logger.log(
      `Sync attempt ${job.attemptsMade + 1} for connection ${job.data.connectionId}`,
    );
    await this.sync.runSync(job.data);
  }
}

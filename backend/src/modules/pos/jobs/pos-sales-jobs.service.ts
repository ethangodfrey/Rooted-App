import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type Job } from 'bullmq';

import { isPosQueuesEnabled } from '../../../common/redis/pos-queues-enabled';
import { PosSalesIngestService } from '../services/pos-sales-ingest.service';
import {
  POS_SALES_INGEST_JOB,
  POS_SALES_INGEST_QUEUE,
} from './pos-sales-queue.constants';
import type { PosSalesIngestJobData } from '../types/ledger-transaction';

@Injectable()
export class PosSalesJobsService {
  private readonly logger = new Logger(PosSalesJobsService.name);
  private readonly queuesEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly ingestService: PosSalesIngestService,
    @Optional() @InjectQueue(POS_SALES_INGEST_QUEUE) private readonly salesQueue: Queue | null,
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
      void this.ingestService.ingest(data).catch((err: Error) => {
        this.logger.error(`Inline POS sales ingest failed: ${err.message}`);
      });
      return Promise.resolve({ id: `${data.provider}:${data.providerEventId}` } as Job<PosSalesIngestJobData>);
    }

    const jobId = `${data.provider}:${data.providerEventId}`;
    return this.salesQueue.add(POS_SALES_INGEST_JOB, data, { jobId });
  }
}

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, type Job } from 'bullmq';

import { isPosQueuesEnabled } from '../../../common/redis/pos-queues-enabled';
import { PosInventorySyncService } from '../services/pos-inventory-sync.service';
import {
  POS_INVENTORY_INGEST_QUEUE,
  POS_INVENTORY_JOBS,
  type PosInventoryWebhookJobData,
} from './pos-inventory-queue.constants';

@Injectable()
export class PosInventoryJobsService {
  private readonly logger = new Logger(PosInventoryJobsService.name);
  private readonly queuesEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    @Optional() @InjectQueue(POS_INVENTORY_INGEST_QUEUE) private readonly ingestQueue: Queue | null,
    private readonly inventory: PosInventorySyncService,
  ) {
    this.queuesEnabled = isPosQueuesEnabled(config);
  }

  enqueueWebhook(data: PosInventoryWebhookJobData): Promise<Job<PosInventoryWebhookJobData>> {
    if (!this.queuesEnabled || !this.ingestQueue) {
      void this.processInline(data).catch((err: Error) => {
        this.logger.error(`Inline inventory webhook failed: ${err.message}`);
      });
      return Promise.resolve({ id: data.providerEventId } as Job<PosInventoryWebhookJobData>);
    }

    return this.ingestQueue.add(POS_INVENTORY_JOBS.INGEST_WEBHOOK, data, {
      jobId: `${data.provider}:${data.providerEventId}`,
      removeOnComplete: { age: 3_600, count: 5_000 },
      removeOnFail: { age: 604_800 },
      attempts: 6,
      backoff: { type: 'exponential', delay: 1_500 },
    });
  }

  private async processInline(data: PosInventoryWebhookJobData): Promise<void> {
    const target = await this.inventory.resolveTarget(data);
    if (!target) return;
    await this.inventory.bufferWebhook(data, target);
  }
}

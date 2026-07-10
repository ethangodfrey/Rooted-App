import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import {
  POS_INVENTORY_COALESCE_MS,
  POS_INVENTORY_FLUSH_QUEUE,
  POS_INVENTORY_INGEST_QUEUE,
  POS_INVENTORY_JOBS,
  type PosInventoryFlushJobData,
  type PosInventoryWebhookJobData,
} from './pos-inventory-queue.constants';
import { PosInventorySyncService } from '../services/pos-inventory-sync.service';

/**
 * Ingest worker: resolves product mappings, merges bursts in Redis, and schedules
 * a single debounced flush job per (productId, eventId) pair.
 *
 * Flush worker: reads the coalesced Redis state and performs one atomic SQL UPDATE,
 * eliminating redundant writes during concurrent market-hour webhook storms.
 */
@Processor(POS_INVENTORY_INGEST_QUEUE, { concurrency: 20 })
export class PosInventoryIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(PosInventoryIngestProcessor.name);

  constructor(
    private readonly inventory: PosInventorySyncService,
    @Optional() @InjectQueue(POS_INVENTORY_FLUSH_QUEUE) private readonly flushQueue: Queue | null,
  ) {
    super();
  }

  async process(job: Job<PosInventoryWebhookJobData>): Promise<void> {
    if (job.name !== POS_INVENTORY_JOBS.INGEST_WEBHOOK) return;

    const target = await this.inventory.resolveTarget(job.data);
    if (!target) {
      this.logger.debug(
        `Skipping inventory webhook ${job.data.providerEventId}: no mapped product/event`,
      );
      return;
    }

    const coalesce = await this.inventory.bufferWebhook(job.data, target);
    if (!coalesce.scheduledFlush || !this.flushQueue) return;

    const flushData: PosInventoryFlushJobData = {
      productId: target.productId,
      eventId: target.eventId,
      vendorId: target.vendorId,
      coalesceKey: coalesce.coalesceKey,
    };

    const flushJobId = this.inventory.debounceKey(target.productId, target.eventId);
    try {
      await this.flushQueue.add(POS_INVENTORY_JOBS.FLUSH_COALESCED, flushData, {
        jobId: flushJobId,
        delay: POS_INVENTORY_COALESCE_MS,
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 8,
        backoff: { type: 'exponential', delay: 2_000 },
      });
    } catch (err) {
      const message = (err as Error).message ?? '';
      if (!message.toLowerCase().includes('job') || !message.toLowerCase().includes('exist')) {
        throw err;
      }
    }
  }
}

@Processor(POS_INVENTORY_FLUSH_QUEUE, { concurrency: 10 })
export class PosInventoryFlushProcessor extends WorkerHost {
  private readonly logger = new Logger(PosInventoryFlushProcessor.name);

  constructor(private readonly inventory: PosInventorySyncService) {
    super();
  }

  async process(job: Job<PosInventoryFlushJobData>): Promise<void> {
    if (job.name !== POS_INVENTORY_JOBS.FLUSH_COALESCED) return;
    try {
      await this.inventory.flushCoalesced(job.data);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '40P01' || code === '40001') {
        this.logger.warn(`Inventory flush lock contention — BullMQ will retry: ${job.id}`);
      }
      throw err;
    }
  }
}

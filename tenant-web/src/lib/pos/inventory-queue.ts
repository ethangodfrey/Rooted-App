import { Queue } from 'bullmq';

import { resolveRedisConnection } from '@/lib/redis/redis-connection';

export const POS_INVENTORY_INGEST_QUEUE = 'pos-inventory-ingest';
export const POS_INVENTORY_INGEST_JOB = 'ingest-webhook';

export interface PosInventoryWebhookJobData {
  provider: 'SQUARE' | 'TOAST';
  providerEventId: string;
  eventType: string;
  providerMerchantId?: string;
  providerLocationId?: string;
  providerCatalogObjectId: string;
  quantityDelta?: number;
  quantityAbsolute?: number;
  observedAt: string;
  rawPayload: Record<string, unknown>;
}

let queue: Queue | null | undefined;

function getQueue(): Queue | null {
  if (queue !== undefined) return queue;

  const connection = resolveRedisConnection();
  if (!connection) {
    queue = null;
    return queue;
  }

  queue = new Queue(POS_INVENTORY_INGEST_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 6,
      backoff: { type: 'exponential', delay: 1_500 },
      removeOnComplete: { age: 3_600, count: 5_000 },
      removeOnFail: { age: 604_800 },
    },
  });

  return queue;
}

/**
 * Enqueue a verified inventory webhook for asynchronous processing.
 * Returns quickly so the POS provider stops retrying; heavy work runs in the
 * BullMQ worker where Redis coalescing prevents database write storms.
 */
export async function enqueueInventoryWebhook(
  data: PosInventoryWebhookJobData,
): Promise<{ queued: boolean; jobId?: string }> {
  const ingestQueue = getQueue();
  if (!ingestQueue) {
    throw new Error('REDIS_URL is not configured for POS inventory ingest');
  }

  const jobId = `${data.provider}:${data.providerEventId}`;
  try {
    const job = await ingestQueue.add(POS_INVENTORY_INGEST_JOB, data, { jobId });
    return { queued: true, jobId: job.id };
  } catch (err) {
    const message = (err as Error).message?.toLowerCase() ?? '';
    if (message.includes('job') && message.includes('exist')) {
      return { queued: true, jobId };
    }
    throw err;
  }
}

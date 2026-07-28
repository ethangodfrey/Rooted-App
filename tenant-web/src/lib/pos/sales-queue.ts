/**
 * BullMQ producer for sales webhook ingest (scaffold).
 * @see tenant-web/src/lib/pos/inventory-queue.ts
 */

import { Queue } from 'bullmq';

import { resolveRedisConnection } from '@/lib/redis/redis-connection';

import type { PosSalesIngestJobData } from './sales/types';

export const POS_SALES_INGEST_QUEUE = 'pos-sales-ingest';
export const POS_SALES_INGEST_JOB = 'ingest-sales-webhook';

/** BullMQ-safe job id (colon-free for broad Redis compatibility). */
export function salesIngestJobId(provider: string, providerEventId: string): string {
  return `ingest-${provider}-${providerEventId}`;
}

let queue: Queue | null | undefined;

function getQueue(): Queue | null {
  if (queue !== undefined) return queue;

  const connection = resolveRedisConnection();
  if (!connection) {
    queue = null;
    return queue;
  }

  queue = new Queue(POS_SALES_INGEST_QUEUE, {
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

export async function enqueueSalesWebhook(
  data: PosSalesIngestJobData,
): Promise<{ queued: boolean; jobId?: string }> {
  const ingestQueue = getQueue();
  if (!ingestQueue) {
    throw new Error('REDIS_URL is not configured for POS sales ingest');
  }

  const jobId = salesIngestJobId(data.provider, data.providerEventId);
  try {
    const job = await ingestQueue.add(POS_SALES_INGEST_JOB, data, { jobId });
    return { queued: true, jobId: job.id };
  } catch (err) {
    const message = (err as Error).message?.toLowerCase() ?? '';
    if (message.includes('job') && message.includes('exist')) {
      return { queued: true, jobId };
    }
    throw err;
  }
}

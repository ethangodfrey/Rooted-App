import { Queue, type ConnectionOptions } from 'bullmq';

const POS_INVENTORY_INGEST_QUEUE = 'pos-inventory-ingest';
const ONLINE_SALE_DEDUCT_JOB = 'online-sale-deduct';

export interface OnlineSaleDeductPayload {
  orderId: string;
  vendorId: string;
  eventId: string;
  productId: string;
  quantity: number;
  provider?: 'SQUARE' | 'TOAST' | null;
  providerCatalogObjectId?: string | null;
}

function resolveRedisConnection(): ConnectionOptions | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: decodeURIComponent(parsed.username) || undefined,
    password: decodeURIComponent(parsed.password) || undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  };
}

/**
 * Enqueue post-purchase inventory deduction jobs onto the established
 * pos-inventory-ingest BullMQ queue.
 */
export async function enqueueOnlineSaleDeductions(
  lines: OnlineSaleDeductPayload[],
): Promise<{ queued: number; skipped: boolean; reason?: string }> {
  const connection = resolveRedisConnection();
  if (!connection) {
    return { queued: 0, skipped: true, reason: 'REDIS_URL not configured' };
  }

  const queue = new Queue(POS_INVENTORY_INGEST_QUEUE, { connection });
  let queued = 0;

  try {
    for (const line of lines) {
      const jobId = `online-sale:${line.orderId}:${line.productId}`;
      try {
        await queue.add(ONLINE_SALE_DEDUCT_JOB, line, {
          jobId,
          removeOnComplete: { age: 86_400, count: 5_000 },
          removeOnFail: { age: 604_800 },
          attempts: 6,
          backoff: { type: 'exponential', delay: 1_500 },
        });
        queued += 1;
      } catch (err) {
        const message = (err as Error).message?.toLowerCase() ?? '';
        if (message.includes('job') && message.includes('exist')) {
          queued += 1;
          continue;
        }
        throw err;
      }
    }
  } finally {
    await queue.close();
  }

  return { queued, skipped: false };
}

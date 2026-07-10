/**
 * Standalone BullMQ worker for POS inventory webhook processing.
 *
 * Run alongside the Nest API in production (or scale horizontally):
 *   REDIS_URL=rediss://... POS_QUEUES_ENABLED=true npx ts-node scripts/run-pos-inventory-worker.ts
 *
 * The ingest layer (Next.js /api/webhooks/pos-sync) only enqueues jobs; this
 * process owns coalescing, debounced flushes, and atomic inventory writes so
 * bursty Square/Toast webhooks never block Postgres connection pools.
 */
import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker } from 'bullmq';

import { AppModule } from '../src/app.module';
import { resolveRedisConnection } from '../src/common/redis/redis-connection';
import {
  POS_INVENTORY_FLUSH_QUEUE,
  POS_INVENTORY_INGEST_QUEUE,
  POS_INVENTORY_JOBS,
  type PosInventoryFlushJobData,
  type PosInventoryWebhookJobData,
} from '../src/modules/pos/jobs/pos-inventory-queue.constants';
import { PosInventorySyncService } from '../src/modules/pos/services/pos-inventory-sync.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('PosInventoryWorker');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const config = app.get(ConfigService);
  const inventory = app.get(PosInventorySyncService);
  const connection = resolveRedisConnection(config);
  const flushQueue = new Queue(POS_INVENTORY_FLUSH_QUEUE, { connection });

  const ingestWorker = new Worker<PosInventoryWebhookJobData>(
    POS_INVENTORY_INGEST_QUEUE,
    async (job) => {
      if (job.name !== POS_INVENTORY_JOBS.INGEST_WEBHOOK) return;
      const target = await inventory.resolveTarget(job.data);
      if (!target) return;

      const coalesce = await inventory.bufferWebhook(job.data, target);
      if (!coalesce.scheduledFlush) return;

      const flushJobId = inventory.debounceKey(target.productId, target.eventId);
      try {
        await flushQueue.add(
          POS_INVENTORY_JOBS.FLUSH_COALESCED,
          {
            productId: target.productId,
            eventId: target.eventId,
            vendorId: target.vendorId,
            coalesceKey: coalesce.coalesceKey,
          },
          {
            jobId: flushJobId,
            delay: 3_000,
            removeOnComplete: true,
            attempts: 8,
            backoff: { type: 'exponential', delay: 2_000 },
          },
        );
      } catch (err) {
        const message = (err as Error).message ?? '';
        if (!message.toLowerCase().includes('exist')) throw err;
      }
    },
    { connection, concurrency: 20 },
  );

  const flushWorker = new Worker<PosInventoryFlushJobData>(
    POS_INVENTORY_FLUSH_QUEUE,
    async (job) => {
      if (job.name !== POS_INVENTORY_JOBS.FLUSH_COALESCED) return;
      await inventory.flushCoalesced(job.data);
    },
    { connection, concurrency: 10 },
  );

  for (const worker of [ingestWorker, flushWorker]) {
    worker.on('failed', (job, err) => {
      logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  logger.log('POS inventory workers running (ingest concurrency=20, flush concurrency=10)');
}

void bootstrap();

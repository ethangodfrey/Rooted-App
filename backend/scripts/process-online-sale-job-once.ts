/**
 * Process a single online-sale-deduct BullMQ job (integration tests / manual replay).
 *
 * Usage:
 *   npx ts-node scripts/process-online-sale-job-once.ts --jobId=online-sale:<orderId>:<productId>
 */
process.env.POS_QUEUES_ENABLED = 'false';

import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';

import {
  POS_INVENTORY_INGEST_QUEUE,
  POS_INVENTORY_JOBS,
  type PosInventoryOnlineSaleJobData,
} from '../src/modules/pos/jobs/pos-inventory-queue.constants';

function parseJobId(): string {
  const arg = process.argv.find((a) => a.startsWith('--jobId='));
  const jobId = arg?.split('=')[1]?.trim();
  if (!jobId) {
    throw new Error('Missing --jobId=online-sale:<orderId>:<productId>');
  }
  return jobId;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('ProcessOnlineSaleJobOnce');
  const jobId = parseJobId();

  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { resolveRedisConnection } = await import('../src/common/redis/redis-connection');
  const { PosInventorySyncService } = await import(
    '../src/modules/pos/services/pos-inventory-sync.service'
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);
  const inventory = app.get(PosInventorySyncService);
  const connection = resolveRedisConnection(config);
  const queue = new Queue(POS_INVENTORY_INGEST_QUEUE, { connection });

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found in queue: ${jobId}`);
    }
    if (job.name !== POS_INVENTORY_JOBS.ONLINE_SALE_DEDUCT) {
      throw new Error(`Expected ${POS_INVENTORY_JOBS.ONLINE_SALE_DEDUCT}, got ${job.name}`);
    }

    const data = job.data as PosInventoryOnlineSaleJobData;
    logger.log(`Processing ${jobId} order=${data.orderId} product=${data.productId} qty=${data.quantity}`);

    await inventory.applyOnlineSaleDeduction(data);

    if (job.token) {
      await job.moveToCompleted('processed-by-integration-test', job.token, false);
    }

    logger.log(`Completed ${jobId}`);
  } finally {
    await queue.close();
    await app.close();
  }
}

void bootstrap();

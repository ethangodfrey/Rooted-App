/**
 * flush-failed-queue.ts
 *
 * Purge failed jobs from the pos-inventory-ingest BullMQ queue only.
 * Does not touch active, waiting, delayed, or completed jobs.
 *
 * Usage:
 *   npm run queue:flush-failed
 *   npx tsx scripts/flush-failed-queue.ts
 *
 * Environment (loaded from .env, backend/.env, tenant-web/.env):
 *   REDIS_URL   Upstash TCP URL for BullMQ
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Queue, type ConnectionOptions } from 'bullmq';

const TARGET_QUEUE = 'pos-inventory-ingest';

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadEnv(): void {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
  loadEnvFile(resolve(root, 'tenant-web/.env'));
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
    connectTimeout: 5_000,
  };
}

async function main(): Promise<void> {
  loadEnv();

  const connection = resolveRedisConnection();
  if (!connection) {
    console.error('[flush-failed-queue] REDIS_URL is not configured.');
    process.exit(1);
  }

  const queue = new Queue(TARGET_QUEUE, { connection });

  try {
    const before = await queue.getJobCounts(
      'active',
      'waiting',
      'delayed',
      'failed',
      'completed',
      'paused',
    );

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  BullMQ failed-job purge — ${TARGET_QUEUE}`);
    console.log(`  ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Before:');
    console.log(
      `  active=${before.active ?? 0}  waiting=${before.waiting ?? 0}  delayed=${before.delayed ?? 0}  failed=${before.failed ?? 0}  completed=${before.completed ?? 0}`,
    );
    console.log('');

    if ((before.failed ?? 0) === 0) {
      console.log('  ✓ No failed jobs to purge — queue already clean.');
      console.log('');
      return;
    }

    const removed = await queue.clean(0, 0, 'failed');

    const after = await queue.getJobCounts(
      'active',
      'waiting',
      'delayed',
      'failed',
      'completed',
      'paused',
    );

    console.log(`Purged ${removed.length} failed job(s) via queue.clean(0, 0, 'failed').`);
    console.log('');
    console.log('After:');
    console.log(
      `  active=${after.active ?? 0}  waiting=${after.waiting ?? 0}  delayed=${after.delayed ?? 0}  failed=${after.failed ?? 0}  completed=${after.completed ?? 0}`,
    );
    console.log('');

    if ((after.failed ?? 0) === 0) {
      console.log('  ✓ Failed job count is 0 — pos-inventory-ingest is clean.');
    } else {
      console.error(`  ✗ Failed job count still ${after.failed ?? 0}.`);
      process.exit(1);
    }

    console.log('');
  } finally {
    await queue.close();
  }
}

main().catch((err) => {
  console.error('[flush-failed-queue] Fatal:', err);
  process.exit(1);
});

/**
 * autonomous-health-check.ts
 *
 * Autonomous platform health audit for the Vendorly maintenance window.
 * Run locally or on a schedule (CI cron, Railway cron, GitHub Actions).
 *
 * Usage:
 *   npm run health:audit
 *   npm run health:audit -- --json
 *
 * Environment (loaded from repo `.env`, `backend/.env`, `tenant-web/.env`):
 *   REDIS_URL                  Upstash TCP URL for BullMQ queue inspection
 *   DATABASE_URL               Supabase Postgres (pooler) for Prisma connectivity
 *   POS_WEBHOOK_PROBE_URL        GET probe target (default: Vercel ingest route)
 *   HEALTH_FAILED_JOBS_THRESHOLD Alert when failed jobs exceed this (default: 25)
 *   HEALTH_DELAYED_JOBS_THRESHOLD Alert when delayed jobs exceed this (default: 500)
 *   HEALTH_ACTIVE_JOBS_WARN      Warn when active jobs exceed this (default: 50)
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { Queue, type ConnectionOptions } from 'bullmq';

const QUEUE_NAMES = [
  'pos-inventory-ingest',
  'pos-inventory-flush',
  'pos-sync',
  'pos-aggregation',
] as const;

const DEFAULT_PROBE_URL =
  'https://vendorly-marketplace1.vercel.app/api/webhooks/pos-sync?provider=SQUARE';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
  durationMs: number;
}

interface AuditReport {
  ranAt: string;
  checks: CheckResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    skip: number;
    healthy: boolean;
  };
}

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnv(): void {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
  loadEnvFile(resolve(root, 'tenant-web/.env'));
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function createPrismaClient(): { client: { $queryRaw: (q: TemplateStringsArray) => Promise<unknown>; $disconnect: () => Promise<void> }; label: string } | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;

  const backendClientPath = resolve(process.cwd(), 'backend/node_modules/@prisma/client');
  if (!existsSync(backendClientPath)) {
    return null;
  }

  const require = createRequire(import.meta.url);
  const { PrismaClient } = require(backendClientPath) as {
    PrismaClient: new (args?: { datasources?: { db: { url: string } } }) => {
      $queryRaw: (q: TemplateStringsArray) => Promise<unknown>;
      $disconnect: () => Promise<void>;
    };
  };

  return {
    label: 'Prisma (backend schema)',
    client: new PrismaClient({ datasources: { db: { url: databaseUrl } } }),
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; durationMs: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, durationMs: Math.round(performance.now() - start) };
}

async function checkRedisQueues(): Promise<CheckResult> {
  const start = performance.now();
  const connection = resolveRedisConnection();

  if (!connection) {
    return {
      name: 'Upstash Redis & BullMQ queues',
      status: 'skip',
      message: 'REDIS_URL not configured — queue depth check skipped',
      durationMs: Math.round(performance.now() - start),
    };
  }

  const failedThreshold = envInt('HEALTH_FAILED_JOBS_THRESHOLD', 25);
  const delayedThreshold = envInt('HEALTH_DELAYED_JOBS_THRESHOLD', 500);
  const activeWarn = envInt('HEALTH_ACTIVE_JOBS_WARN', 50);

  const queues: Queue[] = [];
  const perQueue: Record<string, Record<string, number>> = {};
  let totalFailed = 0;
  let totalDelayed = 0;
  let totalActive = 0;
  let pingOk = false;

  try {
    const probeQueue = new Queue(QUEUE_NAMES[0], { connection });
    queues.push(probeQueue);

    const client = (await probeQueue.client) as { ping: () => Promise<string> };
    const pong = await client.ping();
    pingOk = pong === 'PONG';

    for (const name of QUEUE_NAMES) {
      const queue = name === QUEUE_NAMES[0] ? probeQueue : new Queue(name, { connection });
      if (name !== QUEUE_NAMES[0]) queues.push(queue);

      const counts = await queue.getJobCounts(
        'active',
        'delayed',
        'failed',
        'waiting',
        'completed',
        'paused',
      );
      perQueue[name] = counts;
      totalFailed += counts.failed ?? 0;
      totalDelayed += counts.delayed ?? 0;
      totalActive += counts.active ?? 0;
    }

    const recentFailures: Array<{ queue: string; id: string; name: string; failedReason?: string }> = [];
    for (const name of QUEUE_NAMES) {
      const queue = queues.find((q) => q.name === name) ?? new Queue(name, { connection });
      const failed = await queue.getFailed(0, 2);
      for (const job of failed) {
        recentFailures.push({
          queue: name,
          id: job.id ?? 'unknown',
          name: job.name,
          failedReason: job.failedReason?.slice(0, 120),
        });
      }
    }

    let status: CheckStatus = 'pass';
    const alerts: string[] = [];

    if (!pingOk) {
      status = 'fail';
      alerts.push('Redis PING did not return PONG');
    }
    if (totalFailed > failedThreshold) {
      status = 'fail';
      alerts.push(`failed jobs ${totalFailed} > threshold ${failedThreshold}`);
    } else if (totalFailed > 0) {
      if (status === 'pass') status = 'warn';
      alerts.push(`${totalFailed} failed job(s) present`);
    }
    if (totalDelayed > delayedThreshold) {
      status = status === 'fail' ? 'fail' : 'warn';
      alerts.push(`delayed jobs ${totalDelayed} > threshold ${delayedThreshold}`);
    }
    if (totalActive > activeWarn) {
      if (status === 'pass') status = 'warn';
      alerts.push(`active jobs ${totalActive} > warn threshold ${activeWarn}`);
    }

    const message =
      alerts.length > 0
        ? alerts.join('; ')
        : `Redis up; queues healthy (active=${totalActive}, delayed=${totalDelayed}, failed=${totalFailed})`;

    return {
      name: 'Upstash Redis & BullMQ queues',
      status,
      message,
      details: { pingOk, perQueue, totalActive, totalDelayed, totalFailed, recentFailures },
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      name: 'Upstash Redis & BullMQ queues',
      status: 'fail',
      message: (err as Error).message,
      durationMs: Math.round(performance.now() - start),
    };
  } finally {
    await Promise.all(queues.map((q) => q.close().catch(() => undefined)));
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const start = performance.now();
  const prismaWrap = createPrismaClient();

  if (!prismaWrap) {
    const reason = process.env.DATABASE_URL?.trim()
      ? 'backend Prisma client not generated — run: cd backend && npx prisma generate'
      : 'DATABASE_URL not configured — database check skipped';

    return {
      name: 'Supabase PostgreSQL (Prisma)',
      status: 'skip',
      message: reason,
      durationMs: Math.round(performance.now() - start),
    };
  }

  try {
    const { value: ping, durationMs: pingMs } = await timed(async () => {
      await prismaWrap.client.$queryRaw`SELECT 1`;
      return true;
    });

    const { value: counts, durationMs: countMs } = await timed(async () => {
      const rows = (await prismaWrap.client.$queryRaw`
        select relname as table_name, reltuples::bigint as row_count
        from pg_class
        where relname in ('inventory_transactions', 'pos_connections', 'products')
          and relkind = 'r'
      `) as Array<{ table_name: string; row_count: bigint }>;
      return rows.map((r) => ({ table: r.table_name, approxRows: Number(r.row_count) }));
    });

    void ping;

    const slow = pingMs + countMs > 3_000;
    return {
      name: 'Supabase PostgreSQL (Prisma)',
      status: slow ? 'warn' : 'pass',
      message: slow
        ? `Connected but slow (${pingMs + countMs}ms) — pool may be saturated`
        : `Connected (${pingMs + countMs}ms); table stats available`,
      details: { pingMs, countMs, tableCounts: counts },
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      name: 'Supabase PostgreSQL (Prisma)',
      status: 'fail',
      message: (err as Error).message,
      durationMs: Math.round(performance.now() - start),
    };
  } finally {
    await prismaWrap.client.$disconnect().catch(() => undefined);
  }
}

async function checkWebhookIngest(): Promise<CheckResult> {
  const start = performance.now();
  const probeUrl =
    process.env.POS_WEBHOOK_PROBE_URL?.trim() ||
    process.env.POS_WEBHOOK_TEST_URL?.trim() ||
    DEFAULT_PROBE_URL;

  const parsed = new URL(probeUrl);
  parsed.search = parsed.search || '?provider=SQUARE';
  const url = parsed.toString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'vendorly-health-audit/1.0' },
    });
    clearTimeout(timeout);

    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null;
    }

    const durationMs = Math.round(performance.now() - start);

    if (res.status === 404) {
      return {
        name: 'Vercel POS ingest route',
        status: 'fail',
        message: `GET ${url} returned 404 — route missing or rewrite misconfigured`,
        details: { status: res.status, body: text.slice(0, 200) },
        durationMs,
      };
    }

    if (res.status >= 500) {
      return {
        name: 'Vercel POS ingest route',
        status: 'fail',
        message: `GET ${url} returned ${res.status}`,
        details: { status: res.status, body: text.slice(0, 200) },
        durationMs,
      };
    }

    if (!res.ok) {
      return {
        name: 'Vercel POS ingest route',
        status: 'warn',
        message: `GET ${url} returned ${res.status}`,
        details: { status: res.status, body: text.slice(0, 200) },
        durationMs,
      };
    }

    const endpointOk = body?.ok === true || body?.endpoint === 'pos-sync-ingest';
    return {
      name: 'Vercel POS ingest route',
      status: endpointOk ? 'pass' : 'warn',
      message: endpointOk
        ? `GET ${res.status} in ${durationMs}ms — ingest route reachable`
        : `GET ${res.status} but unexpected body`,
      details: { status: res.status, body, url },
      durationMs,
    };
  } catch (err) {
    return {
      name: 'Vercel POS ingest route',
      status: 'fail',
      message: (err as Error).message,
      details: { url },
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function summarize(checks: CheckResult[]): AuditReport['summary'] {
  const pass = checks.filter((c) => c.status === 'pass').length;
  const warn = checks.filter((c) => c.status === 'warn').length;
  const fail = checks.filter((c) => c.status === 'fail').length;
  const skip = checks.filter((c) => c.status === 'skip').length;
  return { pass, warn, fail, skip, healthy: fail === 0 };
}

function statusIcon(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return '✓';
    case 'warn':
      return '⚠';
    case 'fail':
      return '✗';
    case 'skip':
      return '○';
  }
}

function printReport(report: AuditReport): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Vendorly Autonomous Health Audit');
  console.log(`  ${report.ranAt}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  for (const check of report.checks) {
    const icon = statusIcon(check.status);
    const pad = check.status.toUpperCase().padEnd(4);
    console.log(`  ${icon} [${pad}] ${check.name} (${check.durationMs}ms)`);
    console.log(`         ${check.message}`);
    if (check.details && (check.status === 'fail' || check.status === 'warn')) {
      const snippet = JSON.stringify(check.details, null, 2)
        .split('\n')
        .slice(0, 12)
        .map((line) => `         ${line}`)
        .join('\n');
      console.log(snippet);
    }
    console.log('');
  }

  const { pass, warn, fail, skip, healthy } = report.summary;
  console.log('───────────────────────────────────────────────────────────');
  console.log(
    `  Result: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}  |  pass=${pass}  warn=${warn}  fail=${fail}  skip=${skip}`,
  );
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
}

async function main(): Promise<void> {
  loadEnv();
  const jsonMode = process.argv.includes('--json');

  const checks = await Promise.all([
    checkRedisQueues(),
    checkDatabase(),
    checkWebhookIngest(),
  ]);

  const report: AuditReport = {
    ranAt: new Date().toISOString(),
    checks,
    summary: summarize(checks),
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (!report.summary.healthy) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[health:audit] Fatal error:', err);
  process.exit(1);
});

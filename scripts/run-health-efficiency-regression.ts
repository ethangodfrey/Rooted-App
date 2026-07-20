/**
 * Health and Efficiency Regression Suite orchestrator (`npm run test:all`).
 *
 * Runs permanent modules:
 *   1) partition integrity
 *   2) search latency (P95)
 *   3) scheduler reliability
 * plus core discovery/orders verification scripts.
 *
 * Success lines:
 *   HEALTH_TEST_STARTED
 *   PERFORMANCE_METRICS_VALIDATED
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

const MODULES: Array<{ name: string; script: string }> = [
  {
    name: 'PARTITION_INTEGRITY',
    script: 'scripts/verify-health-partition-integrity.ts',
  },
  {
    name: 'SEARCH_LATENCY',
    script: 'scripts/verify-health-search-latency.ts',
  },
  {
    name: 'SCHEDULER_RELIABILITY',
    script: 'scripts/verify-health-scheduler-reliability.ts',
  },
  {
    name: 'ORDERS_PARTITION_STRATEGY',
    script: 'scripts/verify-orders-partition-strategy.ts',
  },
  {
    name: 'ORDERS_PARTITION_MIGRATION',
    script: 'scripts/verify-orders-partition-migration.ts',
  },
  {
    name: 'DISCOVERY_PARTITION_INDEXING',
    script: 'scripts/verify-discovery-partition-indexing.ts',
  },
  {
    name: 'DISCOVERY_LATENCY_BENCHMARK',
    script: 'scripts/verify-discovery-latency-benchmark.ts',
  },
  {
    name: 'DISCOVERY_PRODUCTION_SYNC_CRON',
    script: 'scripts/verify-discovery-production-sync-cron.ts',
  },
];

function log(message: string): void {
  console.log(message);
}

function runModule(mod: { name: string; script: string }): void {
  log(`HEALTH_TEST_STARTED MODULE=${mod.name}`);
  const result = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      path.join(ROOT, mod.script),
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        TS_NODE_PROJECT: path.join(ROOT, 'scripts/tsconfig.json'),
        TS_NODE_TRANSPILE_ONLY: '1',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(
      `HEALTH_MODULE_FAILED MODULE=${mod.name} EXIT=${result.status ?? 'null'}`,
    );
  }
}

function main(): void {
  log('HEALTH_TEST_STARTED SUITE=HEALTH_EFFICIENCY_REGRESSION');
  const started = Date.now();

  for (const mod of MODULES) {
    runModule(mod);
  }

  // Isolation suite (Jest) — permanent multi-tenant guardrail.
  log('HEALTH_TEST_STARTED MODULE=B2B_ISOLATION');
  const isolation = spawnSync(
    'npm',
    ['test', '--prefix', 'backend', '--', '--testPathPatterns=b2b.isolation', '--no-coverage'],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    },
  );
  if (isolation.stdout) process.stdout.write(isolation.stdout);
  if (isolation.stderr) process.stderr.write(isolation.stderr);
  if (isolation.status !== 0) {
    throw new Error(`HEALTH_MODULE_FAILED MODULE=B2B_ISOLATION EXIT=${isolation.status}`);
  }

  const elapsedMs = Date.now() - started;
  log(
    `PERFORMANCE_METRICS_VALIDATED SUITE=HEALTH_EFFICIENCY_REGRESSION MODULES=${MODULES.length + 1} ELAPSED_MS=${elapsedMs} STATUS=PASS`,
  );
  log('HEALTH_EFFICIENCY_REGRESSION_VERIFIED');
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`HEALTH_EFFICIENCY_REGRESSION_FAILED ERROR=${message}`);
  process.exit(1);
}

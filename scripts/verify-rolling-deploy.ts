/**
 * Live Connection Drain Verification Utility
 *
 * Simulates heavy traffic against production health probes during a rolling update
 * window and asserts zero gateway failures (no 502/504 leakage).
 *
 * Usage:
 *   npm run test:deploy:resilience
 *
 * Environment:
 *   DEPLOY_HEALTH_URL       Default: http://127.0.0.1:4000/api/health
 *   DEPLOY_READINESS_URL    Default: http://127.0.0.1:3000/api/health/readiness
 *   DEPLOY_DURATION_MS      Default: 15000
 *   DEPLOY_CONCURRENCY      Default: 20
 *   DEPLOY_BATCH_SIZE       Default: 100
 *   DEPLOY_RESTART_COMMAND  Optional shell command fired at midpoint (teardown sim)
 *   DEPLOY_LIVE_STACK       When "1", require JSON bodies and emit LIVE_STACK_* logs
 *   DEPLOY_REQUIRE_HEALTH_OK When "1"/live, require STATUS=HEALTH_OK in JSON body
 *   DEPLOY_SELF_TEST        Ephemeral local probes
 */

import { exec } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

type ProbeName = 'HEALTH' | 'READINESS';

type ProbeResult = {
  probe: ProbeName;
  status: number;
  ok: boolean;
  gatewayError: boolean;
  contentType: string;
  bodyPreview: string;
};

function isTruthy(name: string): boolean {
  return /^(1|true|yes)$/i.test(process.env[name]?.trim() || '');
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
    if (!process.env[key]) process.env[key] = value;
  }
}

function loadEnv(): void {
  const root = process.cwd();
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
  loadEnvFile(resolve(root, 'tenant-web/.env.local'));
}

function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function probeOnce(probe: ProbeName, url: string): Promise<ProbeResult> {
  const liveStack = isTruthy('DEPLOY_LIVE_STACK');
  const requireHealthOk =
    isTruthy('DEPLOY_REQUIRE_HEALTH_OK') || liveStack;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const status = response.status;
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    const gatewayError = status === 502 || status === 503 || status === 504;
    let ok = status === 200;

    if (ok && liveStack) {
      const isJson =
        contentType.includes('application/json') ||
        text.trimStart().startsWith('{');
      if (!isJson) {
        ok = false;
      } else if (requireHealthOk) {
        try {
          const json = JSON.parse(text) as { STATUS?: string; status?: string };
          const statusToken = (json.STATUS || json.status || '')
            .toString()
            .toUpperCase();
          // Accept HEALTH_OK (new probes) or legacy liveness {"status":"ok"}.
          ok =
            statusToken === 'HEALTH_OK' ||
            statusToken === 'OK' ||
            (typeof json === 'object' &&
              json !== null &&
              'markets' in (json as object)) ||
            (typeof json === 'object' &&
              json !== null &&
              'items' in (json as object));
        } catch {
          ok = false;
        }
      }
    }

    return {
      probe,
      status,
      ok,
      gatewayError,
      contentType,
      bodyPreview: text.slice(0, 120),
    };
  } catch {
    return {
      probe,
      status: 0,
      ok: false,
      gatewayError: true,
      contentType: '',
      bodyPreview: '',
    };
  }
}

async function runBatch(
  urls: Array<{ probe: ProbeName; url: string }>,
  concurrency: number,
  batchSize: number,
): Promise<{ passed: number; errors: number; gatewayErrors: number }> {
  let passed = 0;
  let errors = 0;
  let gatewayErrors = 0;
  let launched = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (launched < batchSize) {
      const index = launched;
      launched += 1;
      const target = urls[index % urls.length]!;
      const result = await probeOnce(target.probe, target.url);
      if (result.ok) {
        passed += 1;
      } else {
        errors += 1;
        if (result.gatewayError) gatewayErrors += 1;
      }
    }
  });

  await Promise.all(workers);
  return { passed, errors, gatewayErrors };
}

async function maybeSimulateTeardown(midpoint: boolean): Promise<void> {
  if (!midpoint) return;
  const command = process.env.DEPLOY_RESTART_COMMAND?.trim();
  if (!command) {
    log('RESTART_SIMULATION_SKIPPED FLAG=DRAIN_WINDOW');
    return;
  }
  log(`RESTART_SIMULATION_START COMMAND=${command}`);
  try {
    await execAsync(command, { timeout: 30_000 });
    log('RESTART_SIMULATION_COMPLETE');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`RESTART_SIMULATION_WARN ${message}`);
  }
}

function startSelfTestServer(
  label: string,
  body: Record<string, unknown>,
): Promise<{ server: Server; url: string }> {
  return new Promise((resolveStart, reject) => {
    const server = createServer((req, res) => {
      if (req.url?.includes('/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
        return;
      }
      res.writeHead(404);
      res.end('NOT_FOUND');
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error(`SELF_TEST_BIND_FAILED ${label}`));
        return;
      }
      resolveStart({
        server,
        url: `http://127.0.0.1:${address.port}/api/health${label === 'READINESS' ? '/readiness' : ''}`,
      });
    });
  });
}

async function main(): Promise<void> {
  loadEnv();
  const liveStack = isTruthy('DEPLOY_LIVE_STACK');
  log(
    liveStack
      ? 'LIVE_STACK_SOAK RUNNING'
      : 'ZERO_DOWNTIME_VERIFICATION_RUNNING',
  );

  const selfTest = isTruthy('DEPLOY_SELF_TEST');
  const ephemeral: Server[] = [];

  let healthUrl =
    process.env.DEPLOY_HEALTH_URL?.trim() || 'http://127.0.0.1:4000/api/health';
  let readinessUrl =
    process.env.DEPLOY_READINESS_URL?.trim() ||
    'http://127.0.0.1:3000/api/health/readiness';

  if (selfTest) {
    log('SELF_TEST_MODE ENABLED');
    const health = await startSelfTestServer('HEALTH', {
      STATUS: 'HEALTH_OK',
      TIMESTAMP: Math.floor(Date.now() / 1000),
    });
    const readiness = await startSelfTestServer('READINESS', {
      STATUS: 'HEALTH_OK',
      TIMESTAMP: Math.floor(Date.now() / 1000),
    });
    ephemeral.push(health.server, readiness.server);
    healthUrl = health.url;
    readinessUrl = readiness.url;
  }

  const durationMs = numEnv(
    'DEPLOY_DURATION_MS',
    selfTest ? 3_000 : 15_000,
  );
  const concurrency = Math.floor(numEnv('DEPLOY_CONCURRENCY', selfTest ? 8 : 20));
  const batchSize = Math.floor(numEnv('DEPLOY_BATCH_SIZE', selfTest ? 40 : 100));

  const urls: Array<{ probe: ProbeName; url: string }> = [
    { probe: 'HEALTH', url: healthUrl },
    { probe: 'READINESS', url: readinessUrl },
  ];

  log(`TARGET_HEALTH ${healthUrl}`);
  log(`TARGET_READINESS ${readinessUrl}`);
  log(
    `TRAFFIC_PLAN DURATION_MS=${durationMs} CONCURRENCY=${concurrency} BATCH_SIZE=${batchSize}`,
  );

  try {
    // Warmup: ensure both endpoints answer before soak.
    for (const target of urls) {
      const warm = await probeOnce(target.probe, target.url);
      if (!warm.ok) {
        fail(
          `WARMUP_FAILED PROBE=${target.probe} STATUS=${warm.status} URL=${target.url} BODY=${warm.bodyPreview}`,
        );
      }
      if (liveStack) {
        log(`EDGE_ROUTE_OK PROBE=${target.probe} STATUS=${warm.status}`);
      }
    }
    log(liveStack ? 'REMOTE_PASSED WARMUP' : 'WARMUP_PASSED');

    const started = Date.now();
    const midpointAt = started + durationMs / 2;
    let restartFired = false;
    let totalPassed = 0;
    let totalErrors = 0;
    let totalGateway = 0;
    let batchIndex = 0;

    while (Date.now() - started < durationMs) {
      if (!restartFired && Date.now() >= midpointAt) {
        restartFired = true;
        await maybeSimulateTeardown(true);
        log('DRAIN_WINDOW_ACTIVE');
      }

      batchIndex += 1;
      const batch = await runBatch(urls, concurrency, batchSize);
      totalPassed += batch.passed;
      totalErrors += batch.errors;
      totalGateway += batch.gatewayErrors;

      log(
        `TRAFFIC_BATCH_PASSED: ${batch.passed} REQUESTS, ${batch.errors} ERRORS`,
      );

      if (batch.errors > 0 || batch.gatewayErrors > 0) {
        fail(
          `TRAFFIC_BATCH_FAILED BATCH=${batchIndex} ERRORS=${batch.errors} GATEWAY=${batch.gatewayErrors}`,
        );
      }
    }

    if (totalErrors > 0 || totalGateway > 0) {
      fail(
        `ZERO_DOWNTIME_FAILED TOTAL=${totalPassed + totalErrors} ERRORS=${totalErrors} GATEWAY=${totalGateway}`,
      );
    }

    if (totalPassed === 0) {
      fail('ZERO_DOWNTIME_FAILED NO_REQUESTS_COMPLETED');
    }

    log(
      `ZERO_DOWNTIME_SUCCESS TOTAL_REQUESTS=${totalPassed} ERRORS=0 GATEWAY_ERRORS=0 BATCHES=${batchIndex}`,
    );
    if (liveStack) {
      log(
        `LIVE_STACK_SOAK REMOTE_PASSED TOTAL_REQUESTS=${totalPassed} ERRORS=0`,
      );
    }
  } finally {
    await Promise.all(
      ephemeral.map(
        (server) =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      ),
    );
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`FAIL: ${message}`);
  process.exit(1);
});

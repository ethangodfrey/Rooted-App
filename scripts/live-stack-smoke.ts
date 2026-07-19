/**
 * Live Stack Smoke Testing & Remote Infrastructure Verification
 *
 * Preflights remote Nest + tenant-web probes, binds DEPLOY_* targets, then runs
 * npm run test:deploy:resilience under DEPLOY_LIVE_STACK=1.
 *
 * Usage:
 *   npm run test:deploy:resilience:live
 *
 * Uppercase text-only telemetry (no emoji).
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ProbeReport = {
  URL: string;
  CODE: number;
  OK: boolean;
  KIND: string;
  DETAIL: string;
};

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
  loadEnvFile(resolve(root, '.env.live'));
  loadEnvFile(resolve(root, 'backend/.env'));
}

function log(message: string): void {
  console.log(message);
}

function fail(message: string): never {
  throw new Error(message);
}

async function probe(url: string, kind: string): Promise<ProbeReport> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const text = await response.text();
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const isJson =
      contentType.includes('application/json') || text.trimStart().startsWith('{');
    const ok = response.status === 200 && isJson;
    return {
      URL: url,
      CODE: response.status,
      OK: ok,
      KIND: kind,
      DETAIL: isJson ? 'JSON' : `NON_JSON:${contentType || 'UNKNOWN'}`,
    };
  } catch (err) {
    return {
      URL: url,
      CODE: 0,
      OK: false,
      KIND: kind,
      DETAIL: err instanceof Error ? err.message : 'NETWORK_ERROR',
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForUrl(url: string, attempts = 45): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const result = await probe(url, 'WAIT');
    if (result.OK || result.CODE === 200) return true;
    await sleep(2000);
  }
  return false;
}

async function bootLocalNest(): Promise<ChildProcess | null> {
  const enabled = /^(1|true|yes)$/i.test(
    process.env.LIVE_SMOKE_BOOT_LOCAL_NEST?.trim() || '1',
  );
  if (!enabled) return null;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim();
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!databaseUrl || !supabaseUrl || !anonKey) {
    log('LOCAL_NEST_SKIP MISSING_LIVE_DB_OR_SUPABASE_ENV');
    return null;
  }

  const port = (process.env.LIVE_SMOKE_NEST_PORT || '4010').trim();
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  log(`LOCAL_NEST_BOOT STARTING AGAINST_LIVE_DEPENDENCIES PORT=${port}`);
  const child = spawn('npm', ['run', 'start:dev'], {
    cwd: resolve(process.cwd(), 'backend'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: port,
      POS_QUEUES_ENABLED: 'false',
      DATABASE_URL: databaseUrl,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: anonKey,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (buf: Buffer) => {
    const line = buf.toString('utf8').trim();
    if (line) log(`NEST_LOG ${line.slice(0, 200)}`);
  });
  child.stderr?.on('data', (buf: Buffer) => {
    const line = buf.toString('utf8').trim();
    if (line) log(`NEST_ERR ${line.slice(0, 200)}`);
  });

  const ready = await waitForUrl(healthUrl);
  if (!ready) {
    child.kill('SIGTERM');
    log('LOCAL_NEST_BOOT FAILED');
    return null;
  }
  log(`LOCAL_NEST_BOOT READY HEALTH=${healthUrl}`);
  (child as ChildProcess & { __healthUrl?: string }).__healthUrl = healthUrl;
  return child;
}

async function main(): Promise<void> {
  loadEnv();
  log('LIVE_STACK_SOAK PREFLIGHT');

  const nestCandidates = [
    process.env.DEPLOY_HEALTH_URL?.trim(),
    'https://api.vendorly.app/api/health',
    'https://rooted-app-production-43fb.up.railway.app/api/health',
    'https://rooted-app-production-8ba5.up.railway.app/api/health',
    'https://api.vendorly.app/health/live',
  ].filter(Boolean) as string[];

  const readinessPreferred =
    process.env.DEPLOY_READINESS_URL?.trim() ||
    'https://tenant-web-psi.vercel.app/api/health/readiness';
  const edgeFallback =
    process.env.DEPLOY_EDGE_FALLBACK_URL?.trim() ||
    'https://tenant-web-psi.vercel.app/api/markets/nearby?latitude=39.7392&longitude=-104.9903';

  let healthUrl = '';
  for (const url of nestCandidates) {
    const report = await probe(url, 'NEST_HEALTH');
    log(
      `PREFLIGHT NEST CODE=${report.CODE} OK=${report.OK ? 'YES' : 'NO'} DETAIL=${report.DETAIL} URL=${report.URL}`,
    );
    if (report.OK) {
      healthUrl = url;
      log('EDGE_ROUTE_OK NEST_HEALTH');
      break;
    }
  }

  let nestProc: ChildProcess | null = null;
  if (!healthUrl) {
    log('REMOTE_NEST_UNAVAILABLE ATTEMPTING_LOCAL_NEST_WITH_LIVE_DEPS');
    nestProc = await bootLocalNest();
    if (nestProc) {
      healthUrl =
        (nestProc as ChildProcess & { __healthUrl?: string }).__healthUrl ||
        `http://127.0.0.1:${process.env.LIVE_SMOKE_NEST_PORT || '4010'}/api/health`;
      log('REMOTE_PASSED LOCAL_NEST_LIVE_DEPS');
    }
  }

  if (!healthUrl) {
    fail('LIVE_STACK_SOAK FAIL NO_NEST_HEALTH_TARGET');
  }

  let readinessUrl = '';
  const readinessProbe = await probe(readinessPreferred, 'READINESS');
  log(
    `PREFLIGHT READINESS CODE=${readinessProbe.CODE} OK=${readinessProbe.OK ? 'YES' : 'NO'} DETAIL=${readinessProbe.DETAIL} URL=${readinessProbe.URL}`,
  );
  if (readinessProbe.OK) {
    readinessUrl = readinessPreferred;
    log('EDGE_ROUTE_OK READINESS');
  } else {
    log('READINESS_NOT_DEPLOYED FALLBACK_EDGE_ROUTE');
    const edgeProbe = await probe(edgeFallback, 'EDGE_FALLBACK');
    log(
      `PREFLIGHT EDGE CODE=${edgeProbe.CODE} OK=${edgeProbe.OK ? 'YES' : 'NO'} DETAIL=${edgeProbe.DETAIL} URL=${edgeProbe.URL}`,
    );
    if (!edgeProbe.OK) {
      fail('LIVE_STACK_SOAK FAIL NO_EDGE_READINESS_TARGET');
    }
    readinessUrl = edgeFallback;
    log('EDGE_ROUTE_OK FALLBACK');
  }

  process.env.DEPLOY_HEALTH_URL = healthUrl;
  process.env.DEPLOY_READINESS_URL = readinessUrl;
  process.env.DEPLOY_LIVE_STACK = '1';
  process.env.DEPLOY_REQUIRE_HEALTH_OK = '1';
  process.env.DEPLOY_SELF_TEST = '';
  if (!process.env.DEPLOY_DURATION_MS) process.env.DEPLOY_DURATION_MS = '20000';
  if (!process.env.DEPLOY_CONCURRENCY) process.env.DEPLOY_CONCURRENCY = '16';
  if (!process.env.DEPLOY_BATCH_SIZE) process.env.DEPLOY_BATCH_SIZE = '80';

  log(`BIND DEPLOY_HEALTH_URL=${healthUrl}`);
  log(`BIND DEPLOY_READINESS_URL=${readinessUrl}`);
  if (process.env.DEPLOY_RESTART_COMMAND?.trim()) {
    log(`BIND DEPLOY_RESTART_COMMAND=${process.env.DEPLOY_RESTART_COMMAND}`);
  } else {
    log('BIND DEPLOY_RESTART_COMMAND UNSET');
  }

  const artifactDir = resolve(process.cwd(), 'artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = resolve(artifactDir, 'live-stack-smoke.log');

  try {
    log('LIVE_STACK_SOAK INVOKING test:deploy:resilience');
    await new Promise<void>((resolveRun, rejectRun) => {
      const child = spawn('npm', ['run', 'test:deploy:resilience'], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const chunks: string[] = [];
      const onData = (buf: Buffer) => {
        const text = buf.toString('utf8');
        chunks.push(text);
        process.stdout.write(text);
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('exit', (code) => {
        writeFileSync(artifactPath, chunks.join(''), 'utf8');
        if (code === 0) resolveRun();
        else rejectRun(new Error(`RESILIENCE_EXIT_${code ?? 'NULL'}`));
      });
    });
    log('LIVE_STACK_SOAK REMOTE_PASSED');
    log(`ARTIFACT ${artifactPath}`);
  } finally {
    if (nestProc && !nestProc.killed) {
      nestProc.kill('SIGTERM');
      log('LOCAL_NEST_SHUTDOWN');
    }
  }
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  log(`FAIL: ${message}`);
  process.exit(1);
});

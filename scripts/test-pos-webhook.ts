/**
 * test-pos-webhook.ts
 *
 * Simulates a high-concurrency burst of Square `inventory.count.updated`
 * webhooks against the tenant-web ingest route.
 *
 * Usage:
 *   npm run test:webhook
 *
 * Environment (load from repo `.env` or `tenant-web/.env` when present):
 *   POS_WEBHOOK_TEST_URL          Target ingest URL (default: http://localhost:3000/api/webhooks/pos-sync?provider=SQUARE)
 *   POS_INVENTORY_WEBHOOK_URL     Must match tenant-web — used in Square HMAC (notificationUrl + body)
 *   SQUARE_WEBHOOK_SIGNATURE_KEY  Square webhook signature key (required for 200 responses)
 *
 * Optional CLI:
 *   --url <endpoint>   Override POS_WEBHOOK_TEST_URL for this run
 */

import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const TOTAL_REQUESTS = 50;
const COALESCE_REQUESTS = 30;
const UNIQUE_REQUESTS = 20;
const BURST_WINDOW_MS = 2_000;

const COALESCE_CATALOG_ID = 'MOCK_SQUARE_CATALOG_COALESCE_A1B2C3';
const UNIQUE_CATALOG_PREFIX = 'MOCK_SQUARE_CATALOG_UNIQUE_';
const MOCK_MERCHANT_ID = 'MOCK_MERCHANT_VENDORLY_TEST';
const MOCK_LOCATION_ID = 'MOCK_LOCATION_FARMERS_MARKET_01';

interface WebhookScenario {
  label: string;
  catalogObjectId: string;
  quantity: number;
  eventId: string;
}

interface RequestResult {
  index: number;
  label: string;
  catalogObjectId: string;
  status: number;
  ok: boolean;
  body: string;
  latencyMs: number;
  error?: string;
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
  loadEnvFile(resolve(root, 'tenant-web/.env'));
}

function parseCliUrl(): string | null {
  const idx = process.argv.indexOf('--url');
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() ?? null;
}

function resolveTargetUrl(): string {
  const cli = parseCliUrl();
  if (cli) return cli;
  return (
    process.env.POS_WEBHOOK_TEST_URL?.trim() ||
    'http://localhost:3000/api/webhooks/pos-sync?provider=SQUARE'
  );
}

function resolveNotificationUrl(targetUrl: string): string {
  const explicit = process.env.POS_INVENTORY_WEBHOOK_URL?.trim();
  if (explicit) return explicit;

  const parsed = new URL(targetUrl);
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function buildSquareInventoryPayload(input: {
  eventId: string;
  catalogObjectId: string;
  quantity: number;
  merchantId?: string;
  locationId?: string;
}): string {
  const createdAt = new Date().toISOString();
  const payload = {
    merchant_id: input.merchantId ?? MOCK_MERCHANT_ID,
    type: 'inventory.count.updated',
    event_id: input.eventId,
    created_at: createdAt,
    data: {
      type: 'inventory_counts',
      id: randomUUID(),
      object: {
        inventory_counts: [
          {
            catalog_object_id: input.catalogObjectId,
            location_id: input.locationId ?? MOCK_LOCATION_ID,
            quantity: String(input.quantity),
            calculated_at: createdAt,
            state: 'IN_STOCK',
          },
        ],
      },
    },
  };

  return JSON.stringify(payload);
}

function signSquareWebhook(
  rawBody: string,
  notificationUrl: string,
  signatureKey: string,
): string {
  return createHmac('sha256', signatureKey)
    .update(notificationUrl + rawBody)
    .digest('base64');
}

function buildScenarios(): WebhookScenario[] {
  const scenarios: WebhookScenario[] = [];

  for (let i = 0; i < COALESCE_REQUESTS; i += 1) {
    scenarios.push({
      label: `coalesce-${i + 1}`,
      catalogObjectId: COALESCE_CATALOG_ID,
      quantity: 40 + i,
      eventId: `mock-coalesce-event-${i + 1}-${randomUUID()}`,
    });
  }

  for (let i = 0; i < UNIQUE_REQUESTS; i += 1) {
    scenarios.push({
      label: `unique-${i + 1}`,
      catalogObjectId: `${UNIQUE_CATALOG_PREFIX}${String(i + 1).padStart(2, '0')}`,
      quantity: 10 + i,
      eventId: `mock-unique-event-${i + 1}-${randomUUID()}`,
    });
  }

  return scenarios;
}

async function postWebhook(
  targetUrl: string,
  notificationUrl: string,
  signatureKey: string,
  scenario: WebhookScenario,
  index: number,
): Promise<RequestResult> {
  const rawBody = buildSquareInventoryPayload({
    eventId: scenario.eventId,
    catalogObjectId: scenario.catalogObjectId,
    quantity: scenario.quantity,
  });
  const signature = signSquareWebhook(rawBody, notificationUrl, signatureKey);
  const started = performance.now();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-square-hmacsha256-signature': signature,
        'x-pos-provider': 'SQUARE',
      },
      body: rawBody,
    });

    const body = await response.text();
    return {
      index,
      label: scenario.label,
      catalogObjectId: scenario.catalogObjectId,
      status: response.status,
      ok: response.ok,
      body,
      latencyMs: performance.now() - started,
    };
  } catch (err) {
    return {
      index,
      label: scenario.label,
      catalogObjectId: scenario.catalogObjectId,
      status: 0,
      ok: false,
      body: '',
      latencyMs: performance.now() - started,
      error: (err as Error).message,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function runBurst(
  targetUrl: string,
  notificationUrl: string,
  signatureKey: string,
  scenarios: WebhookScenario[],
): Promise<RequestResult[]> {
  const results: RequestResult[] = new Array(scenarios.length);
  const intervalMs = BURST_WINDOW_MS / scenarios.length;

  const burstStarted = performance.now();
  const tasks = scenarios.map((scenario, index) =>
    (async () => {
      await sleep(Math.floor(index * intervalMs));
      results[index] = await postWebhook(
        targetUrl,
        notificationUrl,
        signatureKey,
        scenario,
        index + 1,
      );
    })(),
  );

  await Promise.all(tasks);
  const burstDurationMs = performance.now() - burstStarted;

  return results;
}

function printResultLine(result: RequestResult): void {
  const statusLabel = result.status > 0 ? String(result.status) : 'ERR';
  const suffix = result.error ? ` error=${result.error}` : '';
  const bodyHint =
    !result.ok && result.body ? ` body=${result.body.slice(0, 120)}` : '';
  console.log(
    `[${result.index.toString().padStart(2, '0')}] ${result.label.padEnd(14)} ` +
      `catalog=${result.catalogObjectId.slice(-8)} status=${statusLabel} ` +
      `latency=${result.latencyMs.toFixed(0)}ms${suffix}${bodyHint}`,
  );
}

function summarize(results: RequestResult[], totalDurationMs: number): void {
  const success200 = results.filter((r) => r.status === 200).length;
  const failures = results.filter((r) => r.status !== 200);
  const coalesce = results.filter((r) => r.label.startsWith('coalesce'));
  const unique = results.filter((r) => r.label.startsWith('unique'));
  const coalesce200 = coalesce.filter((r) => r.status === 200).length;
  const unique200 = unique.filter((r) => r.status === 200).length;

  const latencies = results.map((r) => r.latencyMs);
  const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);

  console.log('\n=== POS webhook burst summary ===');
  console.log(`Total requests sent:     ${results.length}`);
  console.log(`200 OK responses:        ${success200}`);
  console.log(`Non-200 / errors:        ${failures.length}`);
  console.log(`Coalesce scenario (same catalog ID): ${coalesce200}/${coalesce.length} OK`);
  console.log(`Unique scenario (distinct catalog IDs): ${unique200}/${unique.length} OK`);
  console.log(`Burst window target:     ${BURST_WINDOW_MS}ms`);
  console.log(`Total execution time:    ${totalDurationMs.toFixed(0)}ms`);
  console.log(`Avg response latency:    ${avgLatency.toFixed(1)}ms`);
  console.log(`Max response latency:    ${maxLatency.toFixed(1)}ms`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const failure of failures) {
      console.log(
        `  - #${failure.index} ${failure.label} status=${failure.status || 'ERR'} ` +
          `${failure.error ?? failure.body}`,
      );
    }
  }

  const coalesceCatalogIds = new Set(coalesce.map((r) => r.catalogObjectId));
  const uniqueCatalogIds = new Set(unique.map((r) => r.catalogObjectId));
  console.log('\nDeduplication / coalescing note:');
  console.log(
    `  Coalesce traffic used 1 catalog object (${COALESCE_CATALOG_ID}) across ${coalesce.length} events.`,
  );
  console.log(
    `  Unique traffic used ${uniqueCatalogIds.size} distinct catalog objects.`,
  );
  console.log(
    '  After this run, inspect worker logs/DB — coalesce events should collapse to far fewer writes than 30.',
  );

  if (coalesceCatalogIds.size !== 1) {
    console.warn('  WARNING: coalesce scenario did not use a single catalog ID as expected.');
  }
}

async function main(): Promise<void> {
  loadEnv();

  const targetUrl = resolveTargetUrl();
  const notificationUrl = resolveNotificationUrl(targetUrl);
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() ?? '';

  if (!signatureKey) {
    console.error(
      'Missing SQUARE_WEBHOOK_SIGNATURE_KEY. Set it in .env or tenant-web/.env to generate valid signatures.',
    );
    process.exit(1);
  }

  const scenarios = buildScenarios();
  if (scenarios.length !== TOTAL_REQUESTS) {
    throw new Error(`Scenario builder mismatch: expected ${TOTAL_REQUESTS}, got ${scenarios.length}`);
  }

  console.log('POS inventory webhook load test');
  console.log(`Target URL:        ${targetUrl}`);
  console.log(`Notification URL:  ${notificationUrl}`);
  console.log(`Requests:          ${TOTAL_REQUESTS} (${COALESCE_REQUESTS} coalesce + ${UNIQUE_REQUESTS} unique)`);
  console.log(`Burst window:      ${BURST_WINDOW_MS}ms\n`);

  const started = performance.now();
  const results = await runBurst(targetUrl, notificationUrl, signatureKey, scenarios);
  const totalDurationMs = performance.now() - started;

  for (const result of results) {
    printResultLine(result);
  }

  summarize(results, totalDurationMs);

  const all200 = results.every((r) => r.status === 200);
  process.exit(all200 ? 0 : 1);
}

void main();

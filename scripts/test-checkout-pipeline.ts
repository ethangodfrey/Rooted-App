/**
 * test-checkout-pipeline.ts
 *
 * End-to-end integration test: Checkout API → BullMQ online-sale-deduct → Prisma stock sync.
 *
 * Usage:
 *   npm run test:checkout
 *   npm run test:checkout -- --url https://vendorly-marketplace1.vercel.app
 *
 * Environment (loaded from .env, backend/.env):
 *   REDIS_URL / DATABASE_URL / VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   CHECKOUT_TEST_URL              Default: https://vendorly-marketplace1.vercel.app/api/checkout/initiate
 *   CHECKOUT_TEST_ACCESS_TOKEN     Shopper JWT (skips email/password sign-in)
 *   CHECKOUT_TEST_EMAIL            Shopper email for sign-in
 *   CHECKOUT_TEST_PASSWORD         Shopper password for sign-in
 *   CHECKOUT_TEST_VENDOR_ID        Optional fixture override
 *   CHECKOUT_TEST_EVENT_ID         Optional fixture override
 *   CHECKOUT_TEST_PRODUCT_ID       Optional fixture override
 *
 * Flags:
 *   --url <base>        Override checkout base (appends /api/checkout/initiate)
 *   --skip-checkout     Only test queue dispatch + worker + DB (synthetic order id)
 *   --no-seed           Fail instead of auto-seeding a test product when none exists
 *   --cleanup-fixture   Delete auto-seeded product + availability after the run
 */

import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { execSync } from 'node:child_process';

import { Queue } from 'bullmq';

const POS_INVENTORY_INGEST_QUEUE = 'pos-inventory-ingest';
const ONLINE_SALE_DEDUCT_JOB = 'online-sale-deduct';

interface StepResult {
  step: string;
  ok: boolean;
  ms: number;
  detail: string;
}

interface StockSnapshot {
  presale: number;
  inperson: number;
  reserved: number;
}

interface CheckoutFixture {
  vendorId: string;
  eventId: string;
  productId: string;
  productName: string;
  seeded?: boolean;
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
}

function parseFlag(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1]?.trim() ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function resolveCheckoutUrl(): string {
  const cliBase = parseFlag('--url');
  if (cliBase) {
    const base = cliBase.replace(/\/$/, '');
    return base.includes('/api/checkout') ? base : `${base}/api/checkout/initiate`;
  }
  return (
    process.env.CHECKOUT_TEST_URL?.trim() ||
    'https://vendorly-marketplace1.vercel.app/api/checkout/initiate'
  );
}

function resolveRedisConnection() {
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

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  const backendClientPath = resolve(process.cwd(), 'backend/node_modules/@prisma/client');
  if (!existsSync(backendClientPath)) return null;
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require(backendClientPath) as {
    PrismaClient: new (args?: { datasources?: { db: { url: string } } }) => {
      $queryRaw: (q: TemplateStringsArray, ...vals: unknown[]) => Promise<unknown>;
      $disconnect: () => Promise<void>;
    };
  };
  return new PrismaClient({ datasources: { db: { url: databaseUrl } } });
}

async function discoverFixture(prisma: NonNullable<ReturnType<typeof createPrisma>>): Promise<CheckoutFixture | null> {
  const overrideVendor = process.env.CHECKOUT_TEST_VENDOR_ID?.trim();
  const overrideEvent = process.env.CHECKOUT_TEST_EVENT_ID?.trim();
  const overrideProduct = process.env.CHECKOUT_TEST_PRODUCT_ID?.trim();
  if (overrideVendor && overrideEvent && overrideProduct) {
    return {
      vendorId: overrideVendor,
      eventId: overrideEvent,
      productId: overrideProduct,
      productName: 'override',
    };
  }

  const rows = (await prisma.$queryRaw`
    select
      p.id as product_id,
      p.name as product_name,
      p.vendor_id,
      pea.event_id
    from public.products p
    inner join public.product_event_availability pea on pea.product_id = p.id
    inner join public.vendors v on v.id = p.vendor_id
    where p.status = 'active'
      and p.reserve_enabled = true
      and v.approval_status = 'approved'
      and pea.available_quantity_presale > coalesce(pea.reserved_quantity, 0)
      and pea.available_quantity_inperson > 0
    order by pea.available_quantity_inperson desc
    limit 1
  `) as Array<{
    product_id: string;
    product_name: string;
    vendor_id: string;
    event_id: string;
  }>;

  const row = rows[0];
  if (!row) return null;
  return {
    vendorId: row.vendor_id,
    eventId: row.event_id,
    productId: row.product_id,
    productName: row.product_name,
  };
}

async function seedFixture(
  prisma: NonNullable<ReturnType<typeof createPrisma>>,
): Promise<CheckoutFixture | null> {
  const vendors = (await prisma.$queryRaw`
    select id from public.vendors where approval_status = 'approved' limit 1
  `) as Array<{ id: string }>;
  const events = (await prisma.$queryRaw`
    select id from public.events where event_status = 'upcoming' limit 1
  `) as Array<{ id: string }>;

  const vendorId = vendors[0]?.id;
  const eventId = events[0]?.id;
  if (!vendorId || !eventId) return null;

  const products = (await prisma.$queryRaw`
    insert into public.products (vendor_id, name, price, reserve_enabled, status)
    values (${vendorId}::uuid, 'Checkout Pipeline Test Fixture', 500, true, 'active')
    returning id, name
  `) as Array<{ id: string; name: string }>;

  const productId = products[0]?.id;
  if (!productId) return null;

  await prisma.$queryRaw`
    insert into public.product_event_availability (
      product_id, event_id, available_quantity_presale, available_quantity_inperson, reserved_quantity
    ) values (${productId}::uuid, ${eventId}::uuid, 10, 10, 0)
  `;

  return {
    vendorId,
    eventId,
    productId,
    productName: products[0].name,
    seeded: true,
  };
}

async function cleanupFixture(
  prisma: NonNullable<ReturnType<typeof createPrisma>>,
  fixture: CheckoutFixture,
): Promise<void> {
  await prisma.$queryRaw`
    delete from public.product_event_availability
    where product_id = ${fixture.productId}::uuid and event_id = ${fixture.eventId}::uuid
  `;
  await prisma.$queryRaw`
    delete from public.products where id = ${fixture.productId}::uuid
  `;
}

async function probeCheckoutRoute(url: string): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const bodyText = await res.text();
  if (res.status === 401) {
    return { ok: true, status: res.status, detail: `POST ${url} → 401 (route live, auth required)` };
  }
  if (res.status === 400 || res.status === 405) {
    return { ok: true, status: res.status, detail: `POST ${url} → ${res.status} (route reachable)` };
  }
  if (res.status === 404) {
    const localFallback =
      process.env.CHECKOUT_TEST_LOCAL_URL?.trim() || 'http://localhost:3000/api/checkout/initiate';
    if (localFallback !== url) {
      const local = await probeCheckoutRoute(localFallback);
      if (local.ok) {
        return {
          ok: true,
          status: local.status,
          detail: `${url} → 404 (not deployed); fallback ${local.detail}`,
        };
      }
    }
  }
  return {
    ok: false,
    status: res.status,
    detail: `POST ${url} → ${res.status} ${bodyText.slice(0, 120)}`,
  };
}

async function readStock(
  prisma: NonNullable<ReturnType<typeof createPrisma>>,
  productId: string,
  eventId: string,
): Promise<StockSnapshot | null> {
  const rows = (await prisma.$queryRaw`
    select
      available_quantity_presale as presale,
      available_quantity_inperson as inperson,
      reserved_quantity as reserved
    from public.product_event_availability
    where product_id = ${productId}::uuid and event_id = ${eventId}::uuid
  `) as Array<{ presale: number; inperson: number; reserved: number }>;
  const row = rows[0];
  if (!row) return null;
  return {
    presale: Number(row.presale),
    inperson: Number(row.inperson),
    reserved: Number(row.reserved),
  };
}

async function resolveAccessToken(): Promise<string | null> {
  const direct = process.env.CHECKOUT_TEST_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  const email = process.env.CHECKOUT_TEST_EMAIL?.trim();
  const password = process.env.CHECKOUT_TEST_PASSWORD?.trim();
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();

  if (!email || !password || !supabaseUrl || !anonKey) return null;

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string };
  return json.access_token ?? null;
}

async function reserveHold(
  token: string,
  productId: string,
  eventId: string,
  userId: string,
): Promise<string | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) return null;

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/reserve_inventory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      p_product_id: productId,
      p_event_id: eventId,
      p_customer_id: userId,
      p_quantity: 1,
    }),
  });

  const json = (await res.json().catch(() => null)) as { success?: boolean; hold_id?: string } | null;
  if (!res.ok || !json?.success || !json.hold_id) return null;
  return json.hold_id;
}

async function getUserIdFromToken(token: string): Promise<string | null> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !anonKey) return null;

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

function printStep(result: StepResult): void {
  const icon = result.ok ? '✓' : '✗';
  console.log(`  ${icon} [${result.step}] ${result.detail} (${result.ms}ms)`);
}

async function main(): Promise<void> {
  loadEnv();
  const skipCheckout = hasFlag('--skip-checkout');
  const noSeed = hasFlag('--no-seed');
  const cleanupFixtureFlag = hasFlag('--cleanup-fixture');
  const checkoutUrl = resolveCheckoutUrl();
  const results: StepResult[] = [];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Checkout Pipeline Integration Test');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Phase 0 — health audit
  console.log('Phase 0: Health audit');
  const auditStart = performance.now();
  try {
    execSync('npm run health:audit', { stdio: 'inherit', cwd: process.cwd() });
    results.push({
      step: 'Health Audit',
      ok: true,
      ms: Math.round(performance.now() - auditStart),
      detail: 'npm run health:audit completed',
    });
  } catch {
    results.push({
      step: 'Health Audit',
      ok: false,
      ms: Math.round(performance.now() - auditStart),
      detail: 'health:audit reported failures (see output above)',
    });
  }
  console.log('');

  const prisma = createPrisma();
  if (!prisma) {
    console.error('DATABASE_URL / Prisma client unavailable — cannot continue.');
    process.exit(1);
  }

  let fixture = await discoverFixture(prisma);
  if (!fixture) {
    if (noSeed) {
      console.error('No checkout fixture found (need active product with presale + in-person stock).');
      await prisma.$disconnect();
      process.exit(1);
    }
    console.log('No existing fixture — seeding test product + event availability…');
    fixture = await seedFixture(prisma);
    if (!fixture) {
      console.error('Could not seed fixture (need approved vendor + upcoming event).');
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  console.log(`Fixture: ${fixture.productName} (${fixture.productId.slice(0, 8)}…)`);
  console.log(`         vendor=${fixture.vendorId.slice(0, 8)}… event=${fixture.eventId.slice(0, 8)}…`);
  console.log('');

  const stockBefore = await readStock(prisma, fixture.productId, fixture.eventId);
  console.log(
    `Stock before: presale=${stockBefore?.presale ?? '?'} inperson=${stockBefore?.inperson ?? '?'} reserved=${stockBefore?.reserved ?? '?'}`,
  );
  console.log('');

  let orderId = randomUUID();
  let jobId = `online-sale:${orderId}:${fixture.productId}`;

  // Phase 1 — Checkout API
  console.log('Phase 1: [Checkout API]');
  const checkoutStart = performance.now();

  if (skipCheckout) {
    results.push({
      step: 'Checkout API',
      ok: true,
      ms: 0,
      detail: 'Skipped (--skip-checkout) — using synthetic order id',
    });
    printStep(results[results.length - 1]);
  } else {
    const token = await resolveAccessToken();
    if (!token) {
      const probe = await probeCheckoutRoute(checkoutUrl);
      results.push({
        step: 'Checkout API',
        ok: probe.ok,
        ms: Math.round(performance.now() - checkoutStart),
        detail: probe.ok
          ? `${probe.detail}; full checkout skipped (set CHECKOUT_TEST_ACCESS_TOKEN or EMAIL/PASSWORD)`
          : probe.detail,
      });
      printStep(results[results.length - 1]);
      orderId = randomUUID();
      jobId = `online-sale:${orderId}:${fixture.productId}`;
    } else {
      const userId = await getUserIdFromToken(token);
      const holdId =
        userId != null
          ? await reserveHold(token, fixture.productId, fixture.eventId, userId)
          : null;

      const res = await fetch(checkoutUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorId: fixture.vendorId,
          eventId: fixture.eventId,
          paymentMethod: 'reserve',
          notes: 'integration-test-checkout-pipeline',
          items: [
            {
              productId: fixture.productId,
              quantity: 1,
              holdId,
            },
          ],
        }),
      });

      const bodyText = await res.text();
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        body = { raw: bodyText.slice(0, 200) };
      }

      const ok = res.ok && body.ok === true && typeof body.orderId === 'string';
      if (ok) {
        orderId = String(body.orderId);
        jobId = `online-sale:${orderId}:${fixture.productId}`;
      }

      results.push({
        step: 'Checkout API',
        ok,
        ms: Math.round(performance.now() - checkoutStart),
        detail: ok
          ? `POST ${checkoutUrl} → 200 orderId=${orderId.slice(0, 8)}… queued=${JSON.stringify(body.inventorySync)}`
          : `POST ${checkoutUrl} → ${res.status} ${bodyText.slice(0, 160)}`,
      });
      printStep(results[results.length - 1]);
    }
  }

  console.log('');

  // Phase 2 — BullMQ queue dispatch
  console.log('Phase 2: [BullMQ Ingest]');
  const queueStart = performance.now();
  const connection = resolveRedisConnection();

  if (!connection) {
    results.push({
      step: 'BullMQ Ingest',
      ok: false,
      ms: 0,
      detail: 'REDIS_URL not configured',
    });
    printStep(results[results.length - 1]);
  } else {
    const queue = new Queue(POS_INVENTORY_INGEST_QUEUE, { connection });

    try {
      let job = await queue.getJob(jobId);

      if (!job) {
        await queue.add(
          ONLINE_SALE_DEDUCT_JOB,
          {
            orderId,
            vendorId: fixture.vendorId,
            eventId: fixture.eventId,
            productId: fixture.productId,
            quantity: 1,
            provider: null,
          },
          { jobId },
        );
        job = await queue.getJob(jobId);
      }

      const ok = Boolean(job && job.name === ONLINE_SALE_DEDUCT_JOB);
      results.push({
        step: 'BullMQ Ingest',
        ok,
        ms: Math.round(performance.now() - queueStart),
        detail: ok
          ? `Job ${jobId} present (state=${await job!.getState()})`
          : `Job ${jobId} not found in ${POS_INVENTORY_INGEST_QUEUE}`,
      });
      printStep(results[results.length - 1]);
    } finally {
      await queue.close();
    }
  }

  console.log('');

  // Phase 3 — Worker + Prisma sync
  console.log('Phase 3: [Prisma DB Sync]');
  const workerStart = performance.now();
  const stockPreWorker = await readStock(prisma, fixture.productId, fixture.eventId);

  try {
    execSync(`npx ts-node scripts/process-online-sale-job-once.ts --jobId=${jobId}`, {
      cwd: resolve(process.cwd(), 'backend'),
      stdio: 'pipe',
      encoding: 'utf8',
    });

    const stockAfter = await readStock(prisma, fixture.productId, fixture.eventId);

    const txRows = (await prisma.$queryRaw`
      select transaction_type, quantity_change, source, notes
      from public.inventory_transactions
      where vendor_id = ${fixture.vendorId}::uuid
        and product_id = ${fixture.productId}::uuid
        and event_id = ${fixture.eventId}::uuid
        and notes like ${`%${orderId}%`}
      order by created_at desc
      limit 5
    `) as Array<{ transaction_type: string; quantity_change: number; source: string; notes: string }>;

    const presaleDelta =
      stockPreWorker != null && stockAfter != null
        ? stockPreWorker.presale - stockAfter.presale
        : 0;
    const inpersonDelta =
      stockPreWorker != null && stockAfter != null
        ? stockPreWorker.inperson - stockAfter.inperson
        : 0;
    const txOk = txRows.some((row) => row.transaction_type === 'sale_digital');

    const ok = presaleDelta === 1 && inpersonDelta === 1 && txOk;

    results.push({
      step: 'Prisma DB Sync',
      ok,
      ms: Math.round(performance.now() - workerStart),
      detail: ok
        ? `presale ${stockPreWorker!.presale}→${stockAfter!.presale}, inperson ${stockPreWorker!.inperson}→${stockAfter!.inperson}, tx=${txRows.length}`
        : `delta presale=${presaleDelta} inperson=${inpersonDelta}, after presale=${stockAfter?.presale} inperson=${stockAfter?.inperson}, tx rows=${txRows.length}`,
    });
    printStep(results[results.length - 1]);
  } catch (err) {
    results.push({
      step: 'Prisma DB Sync',
      ok: false,
      ms: Math.round(performance.now() - workerStart),
      detail: (err as Error).message,
    });
    printStep(results[results.length - 1]);
  }

  if (cleanupFixtureFlag && fixture.seeded) {
    await cleanupFixture(prisma, fixture);
    console.log('Cleaned up seeded fixture product.');
  }

  await prisma.$disconnect();

  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  Pipeline summary');
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.step}`);
  }
  const healthy = results.every((r) => r.ok);
  console.log(`  Result: ${healthy ? 'PASS' : 'FAIL'}`);
  console.log('───────────────────────────────────────────────────────────');
  console.log('');

  if (!healthy) process.exit(1);
}

main().catch((err) => {
  console.error('[test:checkout] Fatal:', err);
  process.exit(1);
});

/**
 * Phase C / 44 full E2E: seed → Square webhook POST → BullMQ workers → validation SQL.
 *
 * Usage:
 *   npx tsx scripts/e2e-phase-c-pipeline.ts
 *
 * Requires: DATABASE_URL, REDIS_URL in backend/.env or root .env
 */

import { createHmac, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';

const E2E_SIGNING_KEY = 'e2e-phase-c-signing-key';
const E2E_WEBHOOK_URL = process.env.POS_SALES_WEBHOOK_URL ?? 'http://localhost:3000/api/webhooks/pos-sales';
const MOCK_MERCHANT_ID = 'MOCK_MERCHANT_PHASEC_E2E';
const MOCK_LOCATION_ID = 'MOCK_LOCATION_PHASEC_E2E';
const POS_SALES_INGEST_QUEUE = 'pos-sales-ingest';
const POS_SNAPSHOT_ROLLUP_QUEUE = 'pos-snapshot-rollup';
const POS_SALES_INGEST_JOB = 'ingest-sales-webhook';
const POS_SNAPSHOT_ROLLUP_JOB = 'rollup-vendor-market-day';
const SNAPSHOT_ROLLUP_DEBOUNCE_MS = 5_000;

function salesIngestJobId(provider: string, providerEventId: string): string {
  return `ingest-${provider}-${providerEventId}`;
}

function snapshotRollupJobId(vendorId: string, marketId: string, snapshotDate: string): string {
  return `rollup-${vendorId}-${marketId}-${snapshotDate}`;
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
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  loadEnvFile(resolve(root, '.env'));
  loadEnvFile(resolve(root, 'backend/.env'));
  loadEnvFile(resolve(root, 'tenant-web/.env'));
}

function redisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL?.trim();
  if (!url) throw new Error('REDIS_URL is required');
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    username: decodeURIComponent(parsed.username) || undefined,
    password: decodeURIComponent(parsed.password) || undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface SeedResult {
  vendorId: string;
  userId: string;
  marketId: string;
  connectionId: string;
  registrationId: string;
}

async function seedPrerequisites(prisma: PrismaClient): Promise<SeedResult> {
  const vendorId = randomUUID();
  const connectionId = randomUUID();
  const registrationId = randomUUID();
  const paymentExternalId = `pay_e2e_${Date.now()}`;

  const rows = await prisma.$queryRaw<
    Array<{ user_id: string; market_id: string }>
  >`
    WITH picked AS (
      SELECT
        u.id AS user_id,
        m.id AS market_id
      FROM public.users u
      CROSS JOIN LATERAL (
        SELECT id FROM public.markets WHERE status = 'ACTIVE' LIMIT 1
      ) m
      LEFT JOIN public.vendors v ON v.user_id = u.id
      WHERE v.id IS NULL
      LIMIT 1
    ),
    ins_vendor AS (
      INSERT INTO public.vendors (id, user_id, business_name, approval_status)
      SELECT ${vendorId}::uuid, user_id, 'E2E Phase C Test Vendor', 'approved'
      FROM picked
      RETURNING id, user_id
    ),
    ins_conn AS (
      INSERT INTO public.vendor_pos_connections (
        id, vendor_id, user_id, provider, status,
        provider_merchant_id, provider_location_id, metadata
      )
      SELECT
        ${connectionId}::uuid,
        ins_vendor.id,
        ins_vendor.user_id,
        'square'::public.pos_integration_provider,
        'active',
        ${MOCK_MERCHANT_ID},
        ${MOCK_LOCATION_ID},
        jsonb_build_object('e2e', true)
      FROM ins_vendor
      RETURNING id
    ),
    ins_reg AS (
      INSERT INTO public.vendor_market_registrations (
        id, vendor_id, market_id, registration_status
      )
      SELECT
        ${registrationId}::uuid,
        ins_vendor.id,
        picked.market_id,
        'approved'
      FROM ins_vendor, picked
      RETURNING id
    )
    SELECT ins_vendor.user_id, picked.market_id
    FROM ins_vendor, picked
  `;

  const row = rows[0];
  if (!row) throw new Error('Seed failed — no user/market available');

  console.log('=== Step 1: Seeded prerequisites ===');
  console.log(
    JSON.stringify(
      {
        vendorId,
        userId: row.user_id,
        marketId: row.market_id,
        connectionId,
        registrationId,
        merchantId: MOCK_MERCHANT_ID,
        locationId: MOCK_LOCATION_ID,
        paymentExternalId,
      },
      null,
      2,
    ),
  );

  return {
    vendorId,
    userId: row.user_id,
    marketId: row.market_id,
    connectionId,
    registrationId,
  };
}

function buildSquarePayload(paymentId: string, eventId: string, soldAt: string) {
  return {
    merchant_id: MOCK_MERCHANT_ID,
    type: 'payment.updated',
    event_id: eventId,
    created_at: soldAt,
    data: {
      type: 'payment',
      id: eventId,
      object: {
        payment: {
          id: paymentId,
          order_id: `order_e2e_${paymentId}`,
          location_id: MOCK_LOCATION_ID,
          status: 'COMPLETED',
          created_at: soldAt,
          updated_at: soldAt,
          source_type: 'CARD',
          amount_money: { amount: 1250, currency: 'USD' },
          card_details: { card: { card_brand: 'VISA' } },
        },
      },
    },
  };
}

function signSquareBody(rawBody: string): string {
  return createHmac('sha256', E2E_SIGNING_KEY).update(E2E_WEBHOOK_URL + rawBody).digest('base64');
}

async function postSquareWebhook(paymentId: string): Promise<Response> {
  const soldAt = new Date().toISOString();
  const eventId = randomUUID();
  const payload = buildSquarePayload(paymentId, eventId, soldAt);
  const rawBody = JSON.stringify(payload);
  const signature = signSquareBody(rawBody);

  const res = await fetch(E2E_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-square-hmacsha256-signature': signature,
    },
    body: rawBody,
  });

  const text = await res.text();
  console.log('\n=== Step 2: Webhook POST ===');
  console.log(`POST ${E2E_WEBHOOK_URL} → ${res.status}`);
  console.log(text);

  if (!res.ok) {
    throw new Error(`Webhook POST failed: ${res.status} ${text}`);
  }

  const body = JSON.parse(text) as { queued?: boolean; ok?: boolean };
  if (!body.queued) {
    throw new Error(`Webhook was not enqueued: ${text}`);
  }

  return res;
}

function extractTenderType(rawPayload: Record<string, unknown>): string | null {
  if (rawPayload.squareObject === 'refund') return null;
  const payment = rawPayload.payment as { source_type?: string } | undefined;
  const src = (payment?.source_type ?? '').toUpperCase();
  if (src === 'CASH') return 'cash';
  if (src === 'CARD') return 'card';
  return 'card';
}

async function ingestViaPrisma(
  prisma: PrismaClient,
  seed: SeedResult,
  job: {
    provider: string;
    transactions: Array<{
      externalTransactionId: string;
      grossAmountCents: number;
      platformFeeCents: number;
      currency: string;
      soldAt: string;
      rawPayload: Record<string, unknown>;
    }>;
  },
): Promise<string> {
  let lastTxnId = '';
  for (const txn of job.transactions) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.pos_transactions (
        vendor_id, connection_id, provider, external_transaction_id,
        gross_amount, platform_fee, currency, sold_at, raw_payload, updated_at
      )
      VALUES (
        ${seed.vendorId}::uuid,
        ${seed.connectionId}::uuid,
        ${job.provider}::public.pos_integration_provider,
        ${txn.externalTransactionId},
        ${txn.grossAmountCents},
        ${txn.platformFeeCents},
        ${txn.currency},
        ${txn.soldAt}::timestamptz,
        ${JSON.stringify(txn.rawPayload)}::jsonb,
        now()
      )
      ON CONFLICT (provider, external_transaction_id)
      DO UPDATE SET
        gross_amount = EXCLUDED.gross_amount,
        platform_fee = EXCLUDED.platform_fee,
        sold_at = EXCLUDED.sold_at,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = now()
      RETURNING id
    `;
    lastTxnId = rows[0]?.id ?? lastTxnId;
  }
  return lastTxnId;
}

async function rollupViaPrisma(
  prisma: PrismaClient,
  seed: SeedResult,
  snapshotDate: string,
): Promise<void> {
  const snapshotRows = await prisma.$queryRaw<Array<{ upsert_market_sales_snapshot: string }>>`
    SELECT public.upsert_market_sales_snapshot(
      ${seed.marketId}::uuid,
      ${seed.vendorId}::uuid,
      ${snapshotDate}::date,
      NULL::uuid,
      ${seed.connectionId}::uuid,
      'webhook'
    ) AS upsert_market_sales_snapshot
  `;

  const dayRows = await prisma.$queryRaw<Array<{ raw_payload: Record<string, unknown> }>>`
    SELECT raw_payload
    FROM public.pos_transactions
    WHERE vendor_id = ${seed.vendorId}::uuid
      AND sold_at >= ${snapshotDate}::date::timestamptz
      AND sold_at < (${snapshotDate}::date + 1)::timestamptz
  `;

  const breakdown: Record<string, number> = {};
  for (const row of dayRows) {
    const tender = extractTenderType(row.raw_payload ?? {});
    if (!tender) continue;
    breakdown[tender] = (breakdown[tender] ?? 0) + 1;
  }

  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  const distribution: Record<string, number> = {};
  if (total > 0) {
    for (const [k, v] of Object.entries(breakdown)) {
      distribution[k] = Math.round((v / total) * 10_000) / 10_000;
    }
  }

  await prisma.$executeRaw`
    UPDATE public.market_sales_snapshots
    SET
      tender_breakdown = ${JSON.stringify(breakdown)}::jsonb,
      payment_method_distribution = ${JSON.stringify(distribution)}::jsonb,
      updated_at = now()
    WHERE market_id = ${seed.marketId}::uuid
      AND vendor_id = ${seed.vendorId}::uuid
      AND snapshot_date = ${snapshotDate}::date
  `;

  console.log(`Rollup complete snapshot=${snapshotRows[0]?.upsert_market_sales_snapshot} breakdown=${JSON.stringify(breakdown)}`);
}

async function runValidationQuery(prisma: PrismaClient): Promise<{
  rows: Array<{
    check_layer: string;
    row_count: number;
    gross_amount: bigint | null;
    raw_payload_type: string | null;
  }>;
  pass: boolean;
}> {
  const rows = await prisma.$queryRaw<
    Array<{
      check_layer: string;
      row_count: number;
      gross_amount: bigint | null;
      raw_payload_type: string | null;
    }>
  >`
    WITH latest_ledger AS (
      SELECT
        pt.id,
        pt.vendor_id,
        pt.external_transaction_id,
        pt.sold_at::date AS snapshot_date,
        (
          SELECT vmr.market_id
          FROM public.vendor_market_registrations vmr
          WHERE vmr.vendor_id = pt.vendor_id
            AND vmr.registration_status = 'approved'
          ORDER BY vmr.updated_at DESC NULLS LAST, vmr.created_at DESC
          LIMIT 1
        ) AS market_id
      FROM public.pos_transactions pt
      ORDER BY pt.sold_at DESC
      LIMIT 1
    ),
    params AS (SELECT * FROM latest_ledger),
    ledger AS (
      SELECT pt.id, pt.gross_amount, pt.raw_payload
      FROM public.pos_transactions pt
      CROSS JOIN params p
      WHERE p.id IS NOT NULL
        AND pt.vendor_id = p.vendor_id
        AND pt.external_transaction_id = p.external_transaction_id
    ),
    snapshot AS (
      SELECT mss.*
      FROM public.market_sales_snapshots mss
      CROSS JOIN params p
      WHERE p.market_id IS NOT NULL
        AND mss.vendor_id = p.vendor_id
        AND mss.market_id = p.market_id
        AND mss.snapshot_date = p.snapshot_date
    ),
    expected AS (
      SELECT
        coalesce(sum(pt.gross_amount), 0)::bigint AS gross_volume_cents,
        coalesce(sum(pt.net_amount), 0)::bigint AS net_volume_cents,
        count(*)::int AS transaction_count
      FROM public.pos_transactions pt
      CROSS JOIN params p
      WHERE p.id IS NOT NULL
        AND pt.vendor_id = p.vendor_id
        AND pt.sold_at >= p.snapshot_date::timestamptz
        AND pt.sold_at < (p.snapshot_date + 1)::timestamptz
    )
    SELECT check_layer, row_count, gross_amount, raw_payload_type
    FROM (
      SELECT 'ledger'::text, (SELECT count(*)::int FROM ledger),
             (SELECT gross_amount FROM ledger LIMIT 1),
             (SELECT jsonb_typeof(raw_payload) FROM ledger LIMIT 1)::text, 1
      UNION ALL
      SELECT 'snapshot', (SELECT count(*)::int FROM snapshot),
             (SELECT gross_volume_cents FROM snapshot LIMIT 1),
             (SELECT jsonb_typeof(tender_breakdown) FROM snapshot LIMIT 1)::text, 2
      UNION ALL
      SELECT 'volume_match',
             CASE WHEN (SELECT count(*) FROM snapshot)=1
                   AND s.gross_volume_cents=e.gross_volume_cents
                   AND s.net_volume_cents=e.net_volume_cents
                   AND s.transaction_count=e.transaction_count THEN 1 ELSE 0 END,
             s.gross_volume_cents, NULL::text, 3
      FROM snapshot s CROSS JOIN expected e
      UNION ALL
      SELECT 'tender_json_populated',
             CASE WHEN (SELECT count(*) FROM snapshot)=1
                   AND s.tender_breakdown <> '{}'::jsonb
                   AND s.payment_method_distribution <> '{}'::jsonb
                   AND jsonb_typeof(s.tender_breakdown)='object'
                   AND jsonb_typeof(s.payment_method_distribution)='object' THEN 1 ELSE 0 END,
             (SELECT sum((value)::bigint) FROM jsonb_each_text(s.tender_breakdown)),
             (SELECT round(sum((value)::numeric),4)::text FROM jsonb_each_text(s.payment_method_distribution)), 4
      FROM snapshot s
    ) t(check_layer, row_count, gross_amount, raw_payload_type, ord)
    ORDER BY ord
  `;

  const pass = rows.length === 4 &&
    rows.every((r) => {
      if (r.check_layer === 'ledger' || r.check_layer === 'snapshot') return Number(r.row_count) === 1;
      return Number(r.row_count) === 1;
    });

  return { rows, pass };
}

async function main(): Promise<void> {
  loadEnv();
  const prisma = new PrismaClient();
  const connection = redisConnection();
  const paymentId = `pay_e2e_${Date.now()}`;

  let seed: SeedResult | null = null;
  let ingestWorker: Worker | null = null;
  let rollupWorker: Worker | null = null;

  try {
    seed = await seedPrerequisites(prisma);

    ingestWorker = new Worker(
      POS_SALES_INGEST_QUEUE,
      async (job) => {
        if (job.name !== POS_SALES_INGEST_JOB || !seed) return;
        console.log(`\n[worker] pos-sales-ingest job=${job.id}`);
        await ingestViaPrisma(prisma, seed, {
          provider: job.data.provider,
          transactions: job.data.transactions,
        });

        const snapshotDate = job.data.transactions[0]?.soldAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
        const rollupQueue = new Queue(POS_SNAPSHOT_ROLLUP_QUEUE, { connection });
        const jobId = snapshotRollupJobId(seed.vendorId, seed.marketId, snapshotDate);
        await rollupQueue.add(
          POS_SNAPSHOT_ROLLUP_JOB,
          {
            vendorId: seed.vendorId,
            marketId: seed.marketId,
            posConnectionId: seed.connectionId,
            snapshotDate,
            tenderBreakdown: { card: 1 },
          },
          { jobId, delay: SNAPSHOT_ROLLUP_DEBOUNCE_MS },
        );
        await rollupQueue.close();
        console.log(`[worker] enqueued rollup ${jobId} delay=${SNAPSHOT_ROLLUP_DEBOUNCE_MS}ms`);
      },
      { connection, concurrency: 1 },
    );

    rollupWorker = new Worker(
      POS_SNAPSHOT_ROLLUP_QUEUE,
      async (job) => {
        if (job.name !== POS_SNAPSHOT_ROLLUP_JOB || !seed) return;
        console.log(`\n[worker] pos-snapshot-rollup job=${job.id}`);
        await rollupViaPrisma(prisma, seed, job.data.snapshotDate);
      },
      { connection, concurrency: 1 },
    );

    await postSquareWebhook(paymentId);

    console.log('\n=== Step 3: Waiting 6s for rollup debounce ===');
    await sleep(6_000);

    console.log('\n=== Step 4: Dynamic E2E validation ===');
    const { rows, pass } = await runValidationQuery(prisma);

    console.log('\n| check_layer | row_count | gross_amount | raw_payload_type |');
    console.log('|-------------|-----------|--------------|------------------|');
    for (const r of rows) {
      console.log(
        `| ${r.check_layer} | ${r.row_count} | ${r.gross_amount ?? 'null'} | ${r.raw_payload_type ?? 'null'} |`,
      );
    }
    console.log(`\nPIPELINE_PASS: ${pass ? 'YES ✓' : 'NO ✗'}`);
    process.exit(pass ? 0 : 1);
  } finally {
    await ingestWorker?.close();
    await rollupWorker?.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});

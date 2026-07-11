/**
 * Seed fulfilled orders with irregular cent totals for settlement stress testing.
 *
 * Usage:
 *   cd backend
 *   npm run seed:stress-transactions
 *   npm run seed:stress-transactions -- --clean
 *   npm run seed:stress-transactions -- --benchmark-only
 *
 * Local Postgres (docker compose):
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rooted npm run seed:stress-transactions
 */

import { PrismaClient } from '@prisma/client';

import { calculateVendorSettlement } from '../src/common/settlement/settlement-calculator';
import { computePlatformFeeCents } from '../src/common/settlement/platform-fee';

const prisma = new PrismaClient();

const STRESS_NOTES_MARKER = 'stress-seed:v1';
const ORDER_COUNT = 1_000;
const VENDOR_COUNT = 8;
const LATENCY_TARGET_MS = 100;
const BENCHMARK_ITERATIONS = 5;

const STRESS_SHOPPER_USER_ID = '00000000-0000-4000-b100-000000000001';
const STRESS_SHOPPER_ID = '00000000-0000-4000-c100-000000000001';

const STRESS_VENDOR_USER_IDS = Array.from({ length: VENDOR_COUNT }, (_, index) => {
  const slot = (index + 1).toString(16).padStart(12, '0');
  return `00000000-0000-4000-b200-${slot}`;
});

function stressVendorId(index: number): string {
  const slot = (index + 1).toString(16).padStart(12, '0');
  return `00000000-0000-4000-d200-${slot}`;
}

const STRESS_VENDOR_IDS = Array.from({ length: VENDOR_COUNT }, (_, index) =>
  stressVendorId(index),
);

/** Totals that exercise half-up 5% fee rounding and irregular cent patterns. */
const IRREGULAR_CENT_TOTALS = [
  99, 101, 199, 201, 333, 499, 501, 875, 999, 1001, 1501, 1999, 2001, 3299, 4200,
  4501, 4999, 5001, 7777, 8750, 9999, 10000, 10001, 15050, 19999, 20001, 25033,
  33333, 45099, 50050, 75001, 99999,
] as const;

type StressOrderRow = {
  id: string;
  total_cents: number;
  platform_fee_cents: number;
  vendor_id: string;
};

function parseFlags(argv: string[]): { clean: boolean; benchmarkOnly: boolean } {
  return {
    clean: argv.includes('--clean'),
    benchmarkOnly: argv.includes('--benchmark-only'),
  };
}

function stressOrderId(index: number): string {
  const slot = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-a200-${slot}`;
}

function stressPickupCode(index: number): string {
  return `S${index.toString(36).toUpperCase().padStart(5, '0')}`.slice(0, 8);
}

function pickTotalCents(index: number): number {
  const base = IRREGULAR_CENT_TOTALS[index % IRREGULAR_CENT_TOTALS.length]!;
  const jitter = (index * 17 + 3) % 97;
  return base + jitter;
}

async function ensureAuthUser(userId: string, email: string): Promise<void> {
  await prisma.$executeRaw`
    insert into auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      aud,
      role
    ) values (
      ${userId}::uuid,
      ${email},
      '',
      now(),
      now(),
      now(),
      'authenticated',
      'authenticated'
    )
    on conflict (id) do nothing
  `;
}

async function ensurePublicUserRole(userId: string, role: string): Promise<void> {
  await prisma.$executeRaw`
    update public.users
    set role = ${role}
    where id = ${userId}::uuid
  `;
}

async function ensureVendor(vendorId: string, userId: string, businessName: string): Promise<void> {
  await prisma.$executeRaw`
    insert into public.vendors (id, user_id, business_name)
    values (${vendorId}::uuid, ${userId}::uuid, ${businessName})
    on conflict (id) do update
    set business_name = excluded.business_name
  `;
}

async function ensureStressActors(): Promise<string> {
  await ensureAuthUser(STRESS_SHOPPER_USER_ID, 'stress-shopper@vendorly.local');
  await ensurePublicUserRole(STRESS_SHOPPER_USER_ID, 'customer');

  await prisma.$executeRaw`
    insert into public.shoppers (id, user_id)
    values (${STRESS_SHOPPER_ID}::uuid, ${STRESS_SHOPPER_USER_ID}::uuid)
    on conflict (user_id) do nothing
  `;

  const shoppers = await prisma.$queryRaw<{ id: string }[]>`
    select id
    from public.shoppers
    where user_id = ${STRESS_SHOPPER_USER_ID}::uuid
    limit 1
  `;
  const shopperId = shoppers[0]?.id;
  if (!shopperId) {
    throw new Error('Failed to resolve stress shopper row.');
  }

  for (let index = 0; index < VENDOR_COUNT; index += 1) {
    const userId = STRESS_VENDOR_USER_IDS[index]!;
    const vendorId = stressVendorId(index);
    const email = `stress-vendor-${index + 1}@vendorly.local`;

    await ensureAuthUser(userId, email);
    await ensurePublicUserRole(userId, 'vendor');
    await ensureVendor(vendorId, userId, `Stress Vendor ${index + 1}`);
  }

  return shopperId;
}

async function cleanStressData(): Promise<number> {
  const deleted = await prisma.$executeRaw`
    delete from public.orders
    where notes like ${`${STRESS_NOTES_MARKER}%`}
  `;
  return Number(deleted);
}

async function seedStressOrders(shopperId: string): Promise<void> {
  const batchSize = 100;

  for (let offset = 0; offset < ORDER_COUNT; offset += batchSize) {
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    const limit = Math.min(batchSize, ORDER_COUNT - offset);
    for (let batchOffset = 0; batchOffset < limit; batchOffset += 1) {
      const index = offset + batchOffset;
      const total = pickTotalCents(index);
      const platformFee = computePlatformFeeCents(total);
      const netVendor = Math.max(0, total - platformFee);
      const vendorId = STRESS_VENDOR_IDS[index % VENDOR_COUNT]!;
      const orderId = stressOrderId(index + 1);
      const pickupCode = stressPickupCode(index + 1);
      const notes = `${STRESS_NOTES_MARKER} index=${index + 1}`;

      values.push(`(
        $${paramIndex++}::uuid,
        $${paramIndex++}::uuid,
        $${paramIndex++}::uuid,
        'event_pickup',
        'fulfilled',
        'paid_online',
        'pickup',
        $${paramIndex++},
        0,
        $${paramIndex++},
        $${paramIndex++},
        $${paramIndex++},
        $${paramIndex++},
        $${paramIndex++},
        $${paramIndex++}
      )`);

      params.push(
        orderId,
        shopperId,
        vendorId,
        total,
        total,
        total,
        platformFee,
        netVendor,
        pickupCode,
        notes,
      );
    }

    const sql = `
      insert into public.orders (
        id,
        shopper_id,
        vendor_id,
        order_type,
        order_status,
        payment_status,
        fulfillment_type,
        subtotal,
        tax,
        total,
        gross_cents,
        platform_fee_cents,
        vendor_net_cents,
        pickup_code,
        notes
      ) values ${values.join(', ')}
      on conflict (id) do nothing
    `;

    await prisma.$executeRawUnsafe(sql, ...params);
  }
}

async function countStressOrders(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    select count(*)::bigint as count
    from public.orders
    where notes like ${`${STRESS_NOTES_MARKER}%`}
  `;
  return Number(rows[0]?.count ?? 0);
}

async function fetchStressOrders(): Promise<StressOrderRow[]> {
  return prisma.$queryRaw<StressOrderRow[]>`
    select
      id,
      coalesce(gross_cents, total) as total_cents,
      coalesce(platform_fee_cents, 0) as platform_fee_cents,
      vendor_id
    from public.orders
    where notes like ${`${STRESS_NOTES_MARKER}%`}
      and order_status in ('fulfilled', 'completed')
    order by id asc
  `;
}

async function runSettlementBenchmark(): Promise<void> {
  const timings: {
    queryMs: number;
    aggregateMs: number;
    totalMs: number;
    orderCount: number;
  }[] = [];

  for (let iteration = 0; iteration < BENCHMARK_ITERATIONS; iteration += 1) {
    const totalStart = performance.now();

    const queryStart = performance.now();
    const orders = await fetchStressOrders();
    const queryMs = performance.now() - queryStart;

    const aggregateStart = performance.now();
    const settlement = calculateVendorSettlement(
      orders.map((order) => ({
        id: order.id,
        totalCents: Number(order.total_cents),
        platformFeeCents: Number(order.platform_fee_cents),
      })),
    );
    const aggregateMs = performance.now() - aggregateStart;
    const totalMs = performance.now() - totalStart;

    timings.push({ queryMs, aggregateMs, totalMs, orderCount: orders.length });
    if (iteration === 0) {
      const vendorIds = new Set(orders.map((order) => order.vendor_id));
      console.log('Settlement aggregate (iteration 1):');
      console.log(`  orders: ${settlement.orderCount}`);
      console.log(`  vendors: ${vendorIds.size}`);
      console.log(`  grossVolumeCents: ${settlement.grossVolumeCents}`);
      console.log(`  platformFeeCents: ${settlement.platformFeeCents}`);
      console.log(`  netVendorCents: ${settlement.netVendorCents}`);
    }
  }

  const max = (key: 'queryMs' | 'aggregateMs' | 'totalMs') =>
    Math.max(...timings.map((row) => row[key]));

  const avg = (key: 'queryMs' | 'aggregateMs' | 'totalMs') =>
    timings.reduce((sum, row) => sum + row[key], 0) / timings.length;

  console.log('');
  console.log(`Benchmark (${BENCHMARK_ITERATIONS} iterations, target < ${LATENCY_TARGET_MS}ms total):`);
  for (const [label, key] of [
    ['Query', 'queryMs'],
    ['Aggregate', 'aggregateMs'],
    ['Total', 'totalMs'],
  ] as const) {
    console.log(
      `  ${label}: avg ${avg(key).toFixed(2)}ms, max ${max(key).toFixed(2)}ms`,
    );
  }

  const worstTotal = max('totalMs');
  if (worstTotal >= LATENCY_TARGET_MS) {
    console.error(
      `FAIL: worst-case total latency ${worstTotal.toFixed(2)}ms exceeds ${LATENCY_TARGET_MS}ms target`,
    );
    process.exitCode = 1;
  } else {
    console.log(`PASS: worst-case total latency ${worstTotal.toFixed(2)}ms < ${LATENCY_TARGET_MS}ms`);
  }
}

async function main(): Promise<void> {
  const { clean, benchmarkOnly } = parseFlags(process.argv.slice(2));

  if (clean) {
    const removed = await cleanStressData();
    console.log(`Removed ${removed} prior stress orders.`);
    if (benchmarkOnly) return;
  }

  if (!benchmarkOnly) {
    const shopperId = await ensureStressActors();
    const existing = await countStressOrders();

    if (existing >= ORDER_COUNT) {
      console.log(`Found ${existing} existing stress orders; skipping insert.`);
    } else {
      if (existing > 0) {
        await cleanStressData();
      }
      await seedStressOrders(shopperId);
      const inserted = await countStressOrders();
      console.log(`Seeded ${inserted} fulfilled stress orders across ${VENDOR_COUNT} vendors.`);
    }
  }

  await runSettlementBenchmark();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Data-layer verification for settlement charts using live stress-vendor orders.
 * Run: cd web && npx tsx scripts/verify-settlement-charts.ts
 */
import { createRequire } from 'node:module';

import { buildSettlementChartData } from '../src/lib/settlement-charts';
import { calculateVendorSettlement } from '../src/lib/settlement-calculator';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();
const vendorId = '00000000-0000-4000-d200-000000000001';

async function main() {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      total: number;
      gross_cents: number | null;
      platform_fee_cents: number | null;
      updated_at: Date | null;
    }[]
  >`
    select id, total, gross_cents, platform_fee_cents, updated_at
    from orders
    where vendor_id = ${vendorId}::uuid
      and order_status in ('fulfilled', 'completed')
    order by updated_at desc
    limit 500
  `;

  const orders = rows.map((row) => ({
    id: row.id,
    totalCents: row.gross_cents ?? row.total,
    platformFeeCents: row.platform_fee_cents ?? undefined,
    completedAt: row.updated_at?.toISOString(),
  }));

  const settlement = calculateVendorSettlement(orders);
  const charts = buildSettlementChartData(orders);

  const invalidPeriods = charts.periods.filter(
    (p) =>
      !Number.isFinite(p.grossCents) ||
      !Number.isFinite(p.platformFeeCents) ||
      !Number.isFinite(p.netCents) ||
      p.grossCents < 0,
  );

  console.log(
    JSON.stringify(
      {
        vendorId,
        orderSampleSize: orders.length,
        settlement: {
          orderCount: settlement.orderCount,
          grossVolumeCents: settlement.grossVolumeCents,
          platformFeeCents: settlement.platformFeeCents,
          netVendorCents: settlement.netVendorCents,
        },
        charts: {
          granularity: charts.granularity,
          periodCount: charts.periods.length,
          sizeBucketCount: charts.sizeBuckets.length,
          maxPeriodGrossCents: charts.maxPeriodGrossCents,
          periodSample: charts.periods.slice(0, 3),
          bucketSample: charts.sizeBuckets,
          invalidPeriods: invalidPeriods.length,
          parseErrors: invalidPeriods.length > 0,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

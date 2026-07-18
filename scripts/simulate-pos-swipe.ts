/**
 * Local smoke helper for the analytics POS webhook engine.
 *
 * Usage:
 *   DATABASE_URL=... npm run pos:simulate-swipe
 *
 * Inserts a historical_sales_metrics row and decrements stock for a seeded product.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path') as typeof import('path');
const { config: loadEnv } = require('dotenv') as typeof import('dotenv');

loadEnv({ path: path.resolve(process.cwd(), 'backend/.env') });
loadEnv();

const { PrismaClient } = require(path.resolve(
  process.cwd(),
  'backend/node_modules/@prisma/client',
)) as {
  PrismaClient: new () => {
    $executeRaw: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<unknown>;
    $queryRaw: <T = unknown>(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<T>;
    $disconnect: () => Promise<void>;
  };
};

type SeedRow = {
  profile_id: string;
  business_name: string;
  product_id: string;
  product_name: string;
  sku: string | null;
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient();
  try {
    console.log('SIMULATE_SWIPE: START');

    const rows = await prisma.$queryRaw<SeedRow[]>`
      select
        u.id as profile_id,
        coalesce(v.business_name, u.name, u.email) as business_name,
        p.id as product_id,
        p.name as product_name,
        p.sku
      from public.users u
      join public.vendors v on v.user_id = u.id
      join public.products p on p.vendor_id = v.id and p.status = 'active'
      where u.email like '%@network-seed.vendorly.local'
      order by p.sku asc nulls last
      limit 1
    `;

    const target = rows[0];
    if (!target) {
      throw new Error('NO SEEDED VENDOR PRODUCT — RUN npm run db:seed:network');
    }

    await prisma.$executeRaw`
      update public.products
      set stock = greatest(stock, 5), updated_at = now()
      where id = ${target.product_id}::uuid
    `;

    const amount = 75;
    const metric = await prisma.$queryRaw<Array<{ id: string }>>`
      insert into public.historical_sales_metrics (
        vendor_id, source, amount, recorded_at
      ) values (
        ${target.profile_id}::uuid,
        'SQUARE'::public.pos_sales_source,
        ${amount},
        now()
      )
      returning id
    `;

    const stock = await prisma.$queryRaw<Array<{ stock: number }>>`
      update public.products
      set stock = stock - 1, updated_at = now()
      where id = ${target.product_id}::uuid and stock >= 1
      returning stock
    `;

    console.log(
      [
        'SIMULATE_SWIPE COMPLETE',
        'SQUARE_WEBHOOK',
        `VENDOR=${target.business_name}`,
        `AMOUNT=$${amount.toFixed(2)}`,
        `SKU=${target.sku ?? 'NONE'}`,
        `METRIC=${metric[0]?.id ?? 'NONE'}`,
        `STOCK_DECREMENT=${stock[0] ? 1 : 0}`,
        `STOCK_AFTER=${stock[0]?.stock ?? 'N/A'}`,
      ].join(' · '),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`SIMULATE_SWIPE FAILED: ${message}`);
  process.exitCode = 1;
});

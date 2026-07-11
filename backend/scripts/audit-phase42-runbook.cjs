const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw`
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in ('regions', 'markets', 'vendor_market_registrations', 'stripe_webhook_events')
    order by tablename
  `;

  const col = await prisma.$queryRaw`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'market_id'
  `;

  const fn = await prisma.$queryRaw`
    select count(*)::int as c from pg_proc where proname = 'vendor_approved_market_ids'
  `;

  const a2 = await prisma.$queryRaw`
    select
      (select count(*)::int from public.regions) as regions,
      (select count(*)::int from public.markets) as markets,
      (select count(*)::int from public.markets where event_id is not null) as markets_with_event_bridge,
      (select count(*)::int from public.events where visibility_status = 'public') as public_events
  `;

  const a3 = await prisma.$queryRaw`
    select
      count(*)::int as total,
      count(*) filter (where market_id is not null)::int as linked,
      count(*) filter (where market_id is null and event_id is not null)::int as eligible,
      count(*) filter (where notes like 'stress-seed:v1%')::int as stress_seed
    from public.orders
  `;

  const policies = await prisma.$queryRaw`
    select tablename, count(*)::int as policies
    from pg_policies
    where schemaname = 'public'
      and tablename in ('regions', 'markets', 'vendor_market_registrations', 'orders')
    group by tablename
    order by tablename
  `;

  const tableNames = tables.map((t) => t.tablename);
  const report = {
    workspace_commit: 'aa292f1',
    gates: {
      phase41_prerequisite: tableNames.includes('stripe_webhook_events'),
      a1_schema_pass:
        tableNames.includes('regions') &&
        tableNames.includes('markets') &&
        tableNames.includes('vendor_market_registrations') &&
        col.length > 0 &&
        fn[0].c > 0,
      a2_gate_pass: Number(a2[0].markets_with_event_bridge) > 0,
      a3_backfill_eligible: Number(a3[0].eligible),
    },
    step_a2: a2[0],
    step_a3: a3[0],
    rls_policies: policies,
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

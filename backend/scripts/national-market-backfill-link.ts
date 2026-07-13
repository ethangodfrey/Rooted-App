/**
 * Backfill national_farmers_markets from regional public.markets and link FK.
 * Uses DATABASE_URL (Prisma). Run after phase44 DDL apply.
 *
 *   cd backend && npx tsx scripts/national-market-backfill-link.ts
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadRootEnv(): void {
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
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

loadRootEnv();

async function seedNationalRegistryFromRegionalMarkets(prisma: PrismaClient): Promise<number> {
  return prisma.$executeRaw`
    insert into public.national_farmers_markets (
      market_name,
      street_address,
      city,
      state,
      zip_code,
      operating_schedules,
      latitude,
      longitude,
      source,
      updated_at
    )
    select distinct on (lower(trim(m.name)), lower(trim(coalesce(m.city, ''))), upper(trim(coalesce(m.state, ''))))
      trim(m.name),
      nullif(trim(m.location_address), ''),
      trim(m.city),
      upper(trim(m.state)),
      nullif(trim(m.zip_code), ''),
      coalesce(m.operating_schedules, '[]'::jsonb),
      m.latitude,
      m.longitude,
      'regional_markets_backfill',
      now()
    from public.markets m
    where m.latitude is not null
      and m.longitude is not null
      and trim(coalesce(m.name, '')) <> ''
      and trim(coalesce(m.city, '')) <> ''
      and trim(coalesce(m.state, '')) <> ''
    order by
      lower(trim(m.name)),
      lower(trim(coalesce(m.city, ''))),
      upper(trim(coalesce(m.state, ''))),
      m.updated_at desc
    on conflict (market_name, city, state) do update set
      street_address = coalesce(excluded.street_address, national_farmers_markets.street_address),
      zip_code = coalesce(excluded.zip_code, national_farmers_markets.zip_code),
      operating_schedules = case
        when national_farmers_markets.operating_schedules = '[]'::jsonb
          then excluded.operating_schedules
        else national_farmers_markets.operating_schedules
      end,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      updated_at = now()
  `;
}

async function linkRegionalMarkets(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`
    update public.markets m
    set national_farmers_market_id = nfm.id,
        updated_at = now()
    from public.national_farmers_markets nfm
    where m.national_farmers_market_id is null
      and lower(trim(m.name)) = lower(trim(nfm.market_name))
      and lower(trim(coalesce(m.city, ''))) = lower(trim(nfm.city))
      and upper(trim(coalesce(m.state, ''))) = upper(trim(nfm.state))
  `;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required (set in repo root .env)');
  }

  const prisma = new PrismaClient();
  try {
    const upserted = await seedNationalRegistryFromRegionalMarkets(prisma);
    await linkRegionalMarkets(prisma);

    const counts = await prisma.$queryRaw<
      Array<{ national_registry: number; linked: number; unlinked: number }>
    >`
      select
        (select count(*)::int from public.national_farmers_markets) as national_registry,
        (select count(*)::int from public.markets where national_farmers_market_id is not null) as linked,
        (select count(*)::int from public.markets where national_farmers_market_id is null) as unlinked
    `;

    console.log(
      JSON.stringify(
        {
          upsertedRowsTouched: Number(upserted),
          nationalRegistryCount: counts[0]?.national_registry ?? 0,
          marketsLinked: counts[0]?.linked ?? 0,
          marketsUnlinked: counts[0]?.unlinked ?? 0,
          source: 'regional_markets_backfill',
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

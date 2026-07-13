/**
 * ingest-national-farmers-markets.ts
 *
 * Resilient batch ingestion worker for the national_farmers_markets registry.
 * Reads USDA market-seed-data.json when present; otherwise backfills from
 * public.markets via DATABASE_URL. Always links markets.national_farmers_market_id.
 *
 * Usage:
 *   DATABASE_URL=... npm run markets:national:ingest
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run markets:national:ingest
 *   npx tsx scripts/ingest-national-farmers-markets.ts market-seed-data.json --dry-run
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import { ingestNationalFarmersMarkets } from './lib/national-market-ingest';
import { readUsdaMarketsJson, type UsdaMarketRecord } from './lib/market-json';
import { normalizeState } from './lib/market-csv';
import { resolveUsdaSchedule } from './lib/usda-schedule';
import type { NationalFarmersMarketRecord } from './lib/national-market-types';

const DEFAULT_INPUT = resolve(process.cwd(), 'market-seed-data.json');

function usdaToNationalRecords(records: UsdaMarketRecord[]): NationalFarmersMarketRecord[] {
  const output: NationalFarmersMarketRecord[] = [];

  for (const record of records) {
    const marketName = record.name?.trim();
    const city = record.city?.trim();
    const state = normalizeState(record.state ?? '');
    const latitude = record.latitude;
    const longitude = record.longitude;

    if (!marketName || !city || !state || latitude == null || longitude == null) continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const schedule = record.schedule ?? resolveUsdaSchedule({ name: record.name });
    const operatingSchedules = [
      {
        dayOfWeek: schedule.typicalDay ?? null,
        startTime: `${schedule.startHour}:00`,
        endTime: `${schedule.endHour}:00`,
        seasonStart: null,
        seasonEnd: null,
        notes: schedule.seasonalSchedule ?? schedule.hoursSummary ?? null,
      },
    ];

    output.push({
      marketName,
      streetAddress: record.location_address?.trim() || record.street?.trim() || null,
      city,
      state,
      zipCode: record.zipcode?.trim() || null,
      operatingSchedules,
      longitude,
      latitude,
      source: 'usda',
      externalId: String(record.id).trim(),
    });
  }

  return output;
}

function runRegionalBackfillAndLink(): void {
  console.log('No USDA JSON or service-role ingest — backfilling from public.markets…');
  execSync('npx tsx scripts/national-market-backfill-link.ts', {
    cwd: resolve(process.cwd(), 'backend'),
    stdio: 'inherit',
    env: process.env,
  });
}

function hasServiceRoleIngest(): boolean {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  return Boolean(key && url);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const inputPath = resolve(positional[0] ?? DEFAULT_INPUT);

  if (!existsSync(inputPath) || !hasServiceRoleIngest()) {
    if (dryRun) {
      console.log(JSON.stringify({ dryRun: true, mode: 'regional_backfill', note: 'Would backfill from public.markets' }, null, 2));
      return;
    }
    runRegionalBackfillAndLink();
    return;
  }

  console.log(`Reading national market records from ${inputPath}…`);
  const usdaRecords = readUsdaMarketsJson(inputPath);
  const records = usdaToNationalRecords(usdaRecords);
  console.log(`Mapped ${records.length} geocoded markets (${usdaRecords.length} source rows).`);

  const result = await ingestNationalFarmersMarkets(records, { dryRun });
  console.log(
    JSON.stringify(
      {
        ...result,
        dryRun,
        note:
          'Coordinates stored as latitude/longitude; PostGIS geography POINT(lon lat) is generated in SQL.',
      },
      null,
      2,
    ),
  );

  if (result.errors.length > 0) {
    process.exitCode = 1;
    return;
  }

  if (!dryRun) {
    runRegionalBackfillAndLink();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

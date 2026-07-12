/**
 * ingest-national-farmers-markets.ts
 *
 * Resilient batch ingestion worker for the national_farmers_markets registry.
 * Reads USDA market-seed-data.json (or a custom JSON array) and upserts in
 * chunks of 500 via the Supabase service-role client.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run markets:national:ingest
 *   npx tsx scripts/ingest-national-farmers-markets.ts market-seed-data.json --dry-run
 */

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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const inputPath = resolve(positional[0] ?? DEFAULT_INPUT);

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
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

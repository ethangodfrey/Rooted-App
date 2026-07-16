/**
 * Seed public.farmers_markets (National Farmers Market Directory).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-markets.ts
 *   npm run markets:seed-directory
 *
 * Optional: SEED_MARKETS_JSON=/path/to/markets.json
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  toInsertRow,
  type FarmersMarketInsertRow,
  type FarmersMarketSeedInput,
} from './lib/seed-markets';

const DEFAULT_SEED: FarmersMarketSeedInput[] = [
  {
    name: 'Denver Union Station Farmers Market',
    street_address: '1701 Wynkoop St',
    city: 'Denver',
    state: 'CO',
    zip_code: '80202',
    latitude: 39.7527,
    longitude: -105.0002,
    operating_hours: 'Sat 9:00–14:00',
    season_start: 'May',
    season_end: 'October',
    website_url: 'https://www.coloradofarmersmarket.com',
  },
  {
    name: 'Cherry Creek Fresh Market',
    street_address: 'First Bank amphitheatre, 299 Milwaukee St',
    city: 'Denver',
    state: 'CO',
    zip_code: '80206',
    latitude: 39.7201,
    longitude: -104.9527,
    operating_hours: 'Sat 9:00–14:00',
    season_start: 'May',
    season_end: 'October',
    website_url: null,
  },
  {
    name: 'Boulder County Farmers Markets — Boulder',
    street_address: '1900 13th St',
    city: 'Boulder',
    state: 'CO',
    zip_code: '80302',
    latitude: 40.0176,
    longitude: -105.2797,
    operating_hours: 'Wed & Sat mornings',
    season_start: 'April',
    season_end: 'November',
    website_url: 'https://bcfm.org',
  },
];

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadSeedInputs(): FarmersMarketSeedInput[] {
  const jsonPath = process.env.SEED_MARKETS_JSON?.trim();
  if (!jsonPath) return DEFAULT_SEED;

  const raw = readFileSync(resolve(jsonPath), 'utf8');
  const parsed = JSON.parse(raw) as FarmersMarketSeedInput[];
  if (!Array.isArray(parsed)) {
    throw new Error('SEED_MARKETS_JSON must be a JSON array of market objects');
  }
  return parsed;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const inputs = loadSeedInputs();
  const rows: FarmersMarketInsertRow[] = [];
  let skipped = 0;

  for (const input of inputs) {
    const row = toInsertRow(input);
    if (!row) {
      skipped += 1;
      continue;
    }
    rows.push(row);
  }

  console.log(
    `[seed-markets] prepared=${rows.length} skipped=${skipped} geom_example=${rows[0]?.geom ?? 'n/a'}`,
  );

  if (dryRun) {
    console.log('[seed-markets] dry-run — no writes');
    return;
  }

  const url = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('farmers_markets')
    .upsert(rows, { onConflict: 'name,city,state' })
    .select('id');

  if (error) {
    throw new Error(`farmers_markets upsert failed: ${error.message}`);
  }

  console.log(`[seed-markets] upserted=${data?.length ?? rows.length}`);
}

main().catch((err: unknown) => {
  console.error(`[seed-markets] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

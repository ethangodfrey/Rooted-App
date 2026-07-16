/**
 * Seed public.farmers_markets (National Farmers Market Directory).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run markets:seed-directory
 *   # or, when service-role is unavailable:
 *   DATABASE_URL=... npm run markets:seed-directory
 *
 * Optional: SEED_MARKETS_JSON=/path/to/markets.json
 *
 * Helpers live in scripts/lib/seed-markets.ts (also re-exported from scripts/lib/markets.ts).
 * Importing those modules does NOT execute this CLI.
 */

import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
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

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadSeedInputs(): FarmersMarketSeedInput[] {
  const jsonPath = env('SEED_MARKETS_JSON');
  if (!jsonPath) return DEFAULT_SEED;

  try {
    const raw = readFileSync(resolve(jsonPath), 'utf8');
    const parsed = JSON.parse(raw) as FarmersMarketSeedInput[];
    if (!Array.isArray(parsed)) {
      throw new Error('SEED_MARKETS_JSON must be a JSON array of market objects');
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to read SEED_MARKETS_JSON (${jsonPath}): ${err instanceof Error ? err.message : err}`,
    );
  }
}

async function upsertViaSupabase(rows: FarmersMarketInsertRow[]): Promise<number> {
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
    throw new Error(`Supabase REST upsert failed: ${error.message}`);
  }
  return data?.length ?? rows.length;
}

/** Fallback when SUPABASE_SERVICE_ROLE_KEY is not configured. */
async function upsertViaDatabaseUrl(rows: FarmersMarketInsertRow[]): Promise<number> {
  const databaseUrl = requireEnv('DATABASE_URL');
  const require = createRequire(resolve('backend/package.json'));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require('pg') as typeof import('pg');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `DATABASE_URL connection failed: ${err instanceof Error ? err.message : err}`,
    );
  }

  try {
    await client.query('begin');
    let upserted = 0;
    for (const row of rows) {
      const result = await client.query(
        `
        insert into public.farmers_markets (
          name, street_address, city, state, zip_code,
          latitude, longitude, geom,
          operating_hours, season_start, season_end, website_url, updated_at
        ) values (
          $1, $2, $3, $4, $5,
          $6, $7, ST_GeogFromText($8),
          $9, $10, $11, $12, $13::timestamptz
        )
        on conflict (name, city, state) do update set
          street_address = excluded.street_address,
          zip_code = excluded.zip_code,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          geom = excluded.geom,
          operating_hours = excluded.operating_hours,
          season_start = excluded.season_start,
          season_end = excluded.season_end,
          website_url = excluded.website_url,
          updated_at = excluded.updated_at
        returning id
        `,
        [
          row.name,
          row.street_address,
          row.city,
          row.state,
          row.zip_code,
          row.latitude,
          row.longitude,
          row.geom,
          row.operating_hours,
          row.season_start,
          row.season_end,
          row.website_url,
          row.updated_at,
        ],
      );
      if (result.rowCount) upserted += result.rowCount;
    }
    await client.query('commit');
    return upserted;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore rollback errors */
    }
    throw new Error(
      `DATABASE_URL upsert failed: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
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

  if (rows.length === 0) {
    throw new Error('No valid market rows to seed (check coordinates / required fields)');
  }

  if (dryRun) {
    console.log('[seed-markets] dry-run — no writes');
    return;
  }

  const hasServiceRole = Boolean(env('SUPABASE_URL') && env('SUPABASE_SERVICE_ROLE_KEY'));
  const hasDatabaseUrl = Boolean(env('DATABASE_URL'));

  if (!hasServiceRole && !hasDatabaseUrl) {
    throw new Error(
      'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (preferred) or DATABASE_URL for direct Postgres upsert',
    );
  }

  if (hasServiceRole) {
    try {
      const upserted = await upsertViaSupabase(rows);
      console.log(`[seed-markets] upserted=${upserted} via=supabase-service-role`);
      return;
    } catch (err) {
      if (!hasDatabaseUrl) throw err;
      console.warn(
        `[seed-markets] service-role path failed (${err instanceof Error ? err.message : err}); falling back to DATABASE_URL`,
      );
    }
  }

  const upserted = await upsertViaDatabaseUrl(rows);
  console.log(`[seed-markets] upserted=${upserted} via=database-url`);
}

main().catch((err: unknown) => {
  console.error(`[seed-markets] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});

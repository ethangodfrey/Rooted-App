import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  toDbRow,
  type NationalFarmersMarketDbRow,
  type NationalFarmersMarketRecord,
  type NationalMarketIngestResult,
} from './national-market-types';

export const NATIONAL_MARKET_BATCH_SIZE = 500;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function createIngestSupabaseClient(): SupabaseClient {
  const url = requireEnv('SUPABASE_URL');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) is required');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function chunkRecords<T>(records: T[], size = NATIONAL_MARKET_BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < records.length; i += size) {
    chunks.push(records.slice(i, i + size));
  }
  return chunks;
}

/**
 * Batch-upsert national market records into public.national_farmers_markets.
 * Coordinates are derived from latitude/longitude via generated geography column
 * (POINT longitude latitude) per PostGIS SRID 4326 convention.
 */
export async function ingestNationalFarmersMarkets(
  records: NationalFarmersMarketRecord[],
  options?: { batchSize?: number; dryRun?: boolean },
): Promise<NationalMarketIngestResult> {
  const batchSize = options?.batchSize ?? NATIONAL_MARKET_BATCH_SIZE;
  const dryRun = options?.dryRun ?? false;

  const dbRows: NationalFarmersMarketDbRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const row = toDbRow(record);
    if (!row) {
      skipped += 1;
      continue;
    }
    dbRows.push(row);
  }

  const batches = chunkRecords(dbRows, batchSize);
  const result: NationalMarketIngestResult = {
    total: records.length,
    inserted: 0,
    skipped,
    batches: batches.length,
    errors: [],
  };

  if (dryRun || dbRows.length === 0) {
    result.inserted = dbRows.length;
    return result;
  }

  const supabase = createIngestSupabaseClient();

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const { error } = await supabase
      .from('national_farmers_markets')
      .upsert(batch, { onConflict: 'market_name,city,state' });

    if (error) {
      result.errors.push(`batch ${i + 1}/${batches.length}: ${error.message}`);
      continue;
    }
    result.inserted += batch.length;
  }

  return result;
}

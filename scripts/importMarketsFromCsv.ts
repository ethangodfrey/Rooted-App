/**
 * importMarketsFromCsv.ts
 *
 * Reads farmers market rows from a CSV file and writes idempotent SQL inserts
 * for Supabase `public.events`. No API keys required.
 *
 * Usage:
 *   npx tsx scripts/importMarketsFromCsv.ts
 *   npx tsx scripts/importMarketsFromCsv.ts data/markets.csv docs/supabase/generated_markets.sql
 *
 * CSV columns (header row required):
 *   external_id, name, description, organizer_name, address, city, state, zipcode,
 *   latitude, longitude, day_of_week, start_hour, end_hour, parking_info, admission_info, source
 *
 * Required: name, city, state, latitude, longitude
 * Defaults: day_of_week=saturday, start_hour=8, end_hour=13
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { dedupeMarkets, readMarketsCsv } from './lib/market-csv';
import { marketsToSql } from './lib/market-sql';

const DEFAULT_INPUT = resolve(process.cwd(), 'data/markets.csv');
const DEFAULT_OUTPUT = resolve(process.cwd(), 'docs/supabase/generated_markets.sql');
const SPLIT_BATCH = 1500;

function main(): void {
  const inputPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_INPUT);
  const outputPath = resolve(process.cwd(), process.argv[3] ?? DEFAULT_OUTPUT);

  const rows = dedupeMarkets(readMarketsCsv(inputPath));

  if (rows.length <= SPLIT_BATCH) {
    writeFileSync(outputPath, marketsToSql(rows, inputPath), 'utf8');
    console.log(`✔ Read ${rows.length} markets from ${inputPath}`);
    console.log(`✔ Wrote SQL to ${outputPath}`);
  } else {
    const outDir = dirname(outputPath);
    mkdirSync(outDir, { recursive: true });
    const parts: string[] = [];

    for (let i = 0; i < rows.length; i += SPLIT_BATCH) {
      const batch = rows.slice(i, i + SPLIT_BATCH);
      const partNo = String(Math.floor(i / SPLIT_BATCH) + 1).padStart(3, '0');
      const partPath = resolve(outDir, `generated_markets_part${partNo}.sql`);
      writeFileSync(partPath, marketsToSql(batch, `${inputPath} (part ${partNo})`), 'utf8');
      parts.push(partPath);
    }

    const index = `-- Rooted market import (${rows.length} markets, ${parts.length} parts)
-- Run each part in Supabase SQL Editor in order: part001, part002, ...
${parts.map((p) => `--   ${p}`).join('\n')}
`;
    writeFileSync(outputPath, index, 'utf8');

    console.log(`✔ Read ${rows.length} markets from ${inputPath}`);
    console.log(`✔ Wrote ${parts.length} SQL parts + index to ${outDir}`);
    parts.forEach((p) => console.log(`   - ${p}`));
  }

  console.log('\nNext: open Supabase → SQL Editor → run generated SQL (index lists parts)');
}

main();

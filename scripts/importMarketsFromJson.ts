/**
 * importMarketsFromJson.ts
 *
 * Reads USDA Local Food Directory API output (market-seed-data.json) and writes
 * upsert SQL for Supabase `public.events`, switching the live catalog away from OSM.
 *
 * Usage:
 *   npx tsx scripts/importMarketsFromJson.ts
 *   npx tsx scripts/importMarketsFromJson.ts market-seed-data.json docs/supabase/generated_usda_markets.sql
 *   npx tsx scripts/importMarketsFromJson.ts --apply
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { readUsdaMarketsJson, usdaJsonToMarketRows } from './lib/market-json';
import { usdaMarketsToSql } from './lib/market-sql';

const DEFAULT_INPUT = resolve(process.cwd(), 'market-seed-data.json');
const DEFAULT_OUTPUT = resolve(process.cwd(), 'docs/supabase/generated_usda_markets.sql');
const SPLIT_BATCH = 1500;
const BACKEND_DIR = resolve(process.cwd(), 'backend');

function listSqlParts(outDir: string): string[] {
  return readdirSync(outDir)
    .filter((name) => /^generated_usda_markets_part\d+\.sql$/.test(name))
    .sort()
    .map((name) => resolve(outDir, name));
}

function applySqlFiles(files: string[]): void {
  for (const file of files) {
    console.log(`→ Applying ${file}`);
    execSync(`npx prisma db execute --file "${file}" --schema prisma/schema.prisma`, {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
    });
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const applyOnly = args.includes('--apply');

  if (applyOnly) {
    const outDir = dirname(DEFAULT_OUTPUT);
    const parts = listSqlParts(outDir);
    if (parts.length === 0) {
      throw new Error(
        `No generated_usda_markets_part*.sql files in ${outDir}. Run without --apply first.`,
      );
    }
    console.log(`Applying ${parts.length} USDA market SQL part(s) to Supabase…`);
    applySqlFiles(parts);
    console.log('✔ USDA markets applied');
    return;
  }

  const positional = args.filter((arg) => !arg.startsWith('--'));
  const inputPath = resolve(process.cwd(), positional[0] ?? DEFAULT_INPUT);
  const outputPath = resolve(process.cwd(), positional[1] ?? DEFAULT_OUTPUT);

  const records = readUsdaMarketsJson(inputPath);
  const rows = usdaJsonToMarketRows(records);

  console.log(`✔ Parsed ${records.length} USDA records → ${rows.length} unique listings with coordinates (location-deduped)`);
  const byType = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.market_type ?? 'farmers_market';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  console.log('  By type:', byType);
  const withProducts = rows.filter((row) => row.extra_info?.includes('Products:')).length;
  const withContact = rows.filter((row) => row.contact_name).length;
  if (withProducts || withContact) {
    console.log(`  ${withProducts} with USDA product lists · ${withContact} with organizer contact`);
  }

  if (rows.length <= SPLIT_BATCH) {
    writeFileSync(outputPath, usdaMarketsToSql(rows, inputPath), 'utf8');
    console.log(`✔ Wrote SQL to ${outputPath}`);
    console.log('\nNext: npm run markets:usda:apply   (or run SQL in Supabase SQL Editor)');
  console.log('Tip: run npm run markets:usda:schedules first to pull hours/parking from USDA detail API.');
    return;
  }

  const outDir = dirname(outputPath);
  mkdirSync(outDir, { recursive: true });
  const parts: string[] = [];

  for (let i = 0; i < rows.length; i += SPLIT_BATCH) {
    const batch = rows.slice(i, i + SPLIT_BATCH);
    const partNo = String(Math.floor(i / SPLIT_BATCH) + 1).padStart(3, '0');
    const partPath = resolve(outDir, `generated_usda_markets_part${partNo}.sql`);
    writeFileSync(
      partPath,
      usdaMarketsToSql(batch, `${inputPath} (part ${partNo})`, {
        includeSwitch: partNo === '001',
      }),
      'utf8',
    );
    parts.push(partPath);
  }

  const index = `-- Rooted USDA market import (${rows.length} markets, ${parts.length} parts)
-- Run each part in Supabase SQL Editor in order: part001, part002, ...
-- Or: npm run markets:usda:apply
${parts.map((p) => `--   ${p}`).join('\n')}
`;
  writeFileSync(outputPath, index, 'utf8');

  console.log(`✔ Wrote ${parts.length} SQL parts + index to ${outDir}`);
  parts.forEach((p) => console.log(`   - ${p}`));
  console.log('\nNext: npm run markets:usda:apply   (or run SQL parts in Supabase SQL Editor)');
}

main();

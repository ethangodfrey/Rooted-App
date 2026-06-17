/**
 * mergeMarketsCsv.ts
 *
 * Merges multiple market CSV files into data/markets.csv (deduped).
 *
 *   npx tsx scripts/mergeMarketsCsv.ts
 *   npx tsx scripts/mergeMarketsCsv.ts data/markets-baseline.csv data/markets-osm.csv
 */

import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dedupeMarkets, marketsToCsv, readMarketsCsv } from './lib/market-csv';

const OUTPUT = resolve(process.cwd(), 'data/markets.csv');
const DEFAULT_INPUTS = [
  resolve(process.cwd(), 'data/markets-baseline.csv'),
  resolve(process.cwd(), 'data/markets-osm.csv'),
  resolve(process.cwd(), 'data/markets-cities.csv'),
];

function main(): void {
  const inputPaths = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_INPUTS;
  const existing = inputPaths.filter((p) => existsSync(p));

  if (existing.length === 0) {
    console.error('✖ No input CSV files found. Run: npm run markets:baseline');
    process.exit(1);
  }

  console.log('Merging:');
  const merged = dedupeMarkets(
    existing.flatMap((p) => {
      console.log(`  + ${p}`);
      return readMarketsCsv(p);
    }),
  );

  writeFileSync(OUTPUT, marketsToCsv(merged), 'utf8');
  console.log(`✔ Merged ${merged.length} markets → ${OUTPUT}`);
}

main();

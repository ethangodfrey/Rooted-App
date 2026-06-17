import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { applyUsdaDetailToRecord, type UsdaMarketRecord } from './lib/market-json';
import { fetchUsdaListingDetail } from './lib/usda-schedule';
import type { UsdaDirectorySlug } from './lib/usda-directories';

const INPUT = resolve(process.cwd(), 'market-seed-data.json');
const DELAY_MS = 120;

function bareListingId(record: UsdaMarketRecord): string {
  const id = String(record.id);
  const idx = id.indexOf(':');
  return idx >= 0 ? id.slice(idx + 1) : id;
}

function directoryForRecord(record: UsdaMarketRecord): UsdaDirectorySlug {
  if (record.directory) return record.directory;
  const id = String(record.id);
  const idx = id.indexOf(':');
  if (idx > 0) return id.slice(0, idx) as UsdaDirectorySlug;
  return 'farmersmarket';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function dedupeById(records: UsdaMarketRecord[]): UsdaMarketRecord[] {
  const byId = new Map<string, UsdaMarketRecord>();
  for (const record of records) {
    byId.set(String(record.id), record);
  }
  return [...byId.values()];
}

async function main(): Promise<void> {
  const limitArg = process.argv.indexOf('--limit');
  const limit =
    limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY;

  const records = dedupeById(JSON.parse(readFileSync(INPUT, 'utf8')) as UsdaMarketRecord[]);
  const targets = records.slice(0, Number.isFinite(limit) ? limit : records.length);

  let fromDetail = 0;
  let fromName = 0;
  let defaulted = 0;
  let withParking = 0;

  for (let i = 0; i < targets.length; i += 1) {
      const record = targets[i];
      const directory = directoryForRecord(record);
      const detail = await fetchUsdaListingDetail(bareListingId(record), directory);
    applyUsdaDetailToRecord(record, detail);

    const source = record.schedule?.source;
    if (source === 'usda_detail') fromDetail += 1;
    else if (source === 'market_name') fromName += 1;
    else defaulted += 1;
    if (record.detail?.parking) withParking += 1;

    if ((i + 1) % 25 === 0 || i === targets.length - 1) {
      process.stdout.write(
        `\rEnriched: ${i + 1}/${targets.length} (hours=${fromDetail}, name=${fromName}, default=${defaulted}, parking=${withParking})`,
      );
    }

    await sleep(DELAY_MS);
  }

  const merged = records.map((record) => targets.find((item) => item.id === record.id) ?? record);
  writeFileSync(INPUT, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`\n✔ Enriched ${targets.length} USDA markets in ${INPUT}`);
  console.log(`  Real hours from USDA detail: ${fromDetail}`);
  console.log(`  Day inferred from name:      ${fromName}`);
  console.log(`  Default Saturday hours:      ${defaulted}`);
  console.log(`  Parking from USDA detail:    ${withParking}`);
  console.log('\nNext: npm run markets:usda:import && npm run markets:usda:apply');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * fetchMarketsFromOsm.ts — discover real farmers markets (OSM + deep Nominatim)
 *
 *   npm run markets:fetch:nominatim          # deep mode (recommended on your network)
 *   npx tsx scripts/fetchMarketsFromOsm.ts --states CO --mode deep
 *   npx tsx scripts/fetchMarketsFromOsm.ts --mode fast --cities 5
 *
 * Requires data/markets-cities.csv for city-level Nominatim (run markets:cities first).
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { discoverMarketsForState, type DiscoveryMode } from './lib/deep-market-discovery';
import { dedupeMarkets, marketsToCsv } from './lib/market-csv';
import { US_STATE_BBOXES } from './lib/us-state-bboxes';

const DEFAULT_OUTPUT = resolve(process.cwd(), 'data/markets-osm.csv');

function parseArgs() {
  const args = process.argv.slice(2);
  let outputPath = DEFAULT_OUTPUT;
  let states: string[] | null = null;
  let timeoutMs = 45_000;
  let delayMs = 400;
  let skip = process.env.SKIP_MARKETS_OSM === '1';
  let mode: DiscoveryMode = 'deep';
  let citiesPerState = 40;
  let overpassTiles = 3;
  let tryOverpass = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--skip') skip = true;
    if (arg === '--overpass') tryOverpass = true;
    if (arg === '--timeout' && args[i + 1]) timeoutMs = Number(args[++i]);
    if (arg === '--delay' && args[i + 1]) delayMs = Number(args[++i]);
    if (arg === '--mode' && args[i + 1]) mode = args[++i] === 'fast' ? 'fast' : 'deep';
    if (arg === '--cities' && args[i + 1]) citiesPerState = Number(args[++i]);
    if (arg === '--tiles' && args[i + 1]) overpassTiles = Number(args[++i]);
    if (arg === '--states' && args[i + 1]) {
      states = args[++i].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    }
    if (arg.endsWith('.csv')) outputPath = resolve(process.cwd(), arg);
  }

  return { outputPath, states, timeoutMs, delayMs, skip, mode, citiesPerState, overpassTiles, tryOverpass };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function estimateMinutes(mode: DiscoveryMode, states: number, citiesPerState: number): number {
  const stateQueries = 7;
  const cities = mode === 'deep' ? citiesPerState : Math.min(8, citiesPerState);
  const grid = mode === 'deep' ? 16 : 0;
  const queriesPerState = stateQueries + cities + grid;
  return Math.ceil((states * queriesPerState * 1.1) / 60);
}

async function main(): Promise<void> {
  const {
    outputPath,
    states,
    timeoutMs,
    delayMs,
    skip,
    mode,
    citiesPerState,
    overpassTiles,
    tryOverpass,
  } = parseArgs();

  if (skip) {
    writeFileSync(outputPath, marketsToCsv([]), 'utf8');
    console.log(`✔ Wrote empty ${outputPath} (SKIP_MARKETS_OSM=1)`);
    return;
  }

  const targets = states
    ? US_STATE_BBOXES.filter((s) => states.includes(s.abbr))
    : US_STATE_BBOXES;

  if (targets.length === 0) {
    console.error('No matching states.');
    process.exit(1);
  }

  const eta = estimateMinutes(mode, targets.length, citiesPerState);
  console.log(
    `Discovering farmers markets — mode=${mode}, states=${targets.length}, ` +
      `cities/state=${citiesPerState}, overpass=${tryOverpass ? `${overpassTiles}x${overpassTiles} grid` : 'off'}`,
  );
  console.log(`Estimated time: ~${eta} minutes (Nominatim rate limit ~1 req/sec)\n`);

  const all = [];
  const failures: { state: string; error: string }[] = [];

  for (let i = 0; i < targets.length; i++) {
    const state = targets[i];
    const prefix = `[${i + 1}/${targets.length}] ${state.abbr}`;
    console.log(`${prefix} — starting`);
    try {
      const rows = await discoverMarketsForState(state, {
        mode,
        timeoutMs,
        overpassTiles,
        citiesPerState,
        tryOverpass,
        onStatus: (msg) => console.log(`${prefix} — ${msg}`),
      });
      all.push(...rows);
      console.log(`${prefix} — done (${rows.length} markets)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ state: state.name, error: message });
      console.log(`${prefix} — ERROR (${message})`);
    }
    if (i < targets.length - 1) await sleep(delayMs);
  }

  const deduped = dedupeMarkets(all);
  writeFileSync(outputPath, marketsToCsv(deduped), 'utf8');

  console.log('\n────────────────────────────────────────');
  console.log(`✔ Wrote ${deduped.length} unique real markets → ${outputPath}`);
  if (failures.length) {
    console.log(`⚠ ${failures.length} state(s) had errors`);
  }
  console.log('Next: npm run markets:merge && npm run markets:import');
  console.log('────────────────────────────────────────');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

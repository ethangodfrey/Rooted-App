/**
 * fetchCityMarketsCsv.ts
 *
 * Builds data/markets-cities.csv from a free public US cities dataset (no API key).
 * One farmers market entry per city in the dataset (~20k US cities).
 *
 *   npx tsx scripts/fetchCityMarketsCsv.ts
 *   npx tsx scripts/fetchCityMarketsCsv.ts --per-state 10
 *
 * Source: dr5hn/countries-states-cities-database (GitHub, open data)
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { dedupeMarkets, marketsToCsv, normalizeState, type MarketCsvRow } from './lib/market-csv';

const CITIES_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bstates%2Bcities.json';
const OUTPUT = resolve(process.cwd(), 'data/markets-cities.csv');

interface RawCity {
  id: number;
  name: string;
  latitude?: string;
  longitude?: string;
  state_code?: string;
}

interface RawState {
  iso2?: string;
  name?: string;
  cities?: RawCity[];
}

interface RawCountry {
  iso2?: string;
  states?: RawState[];
}

function parseArgs(): { perState: number | null } {
  const args = process.argv.slice(2);
  let perState: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--per-state' && args[i + 1]) {
      perState = Number(args[++i]);
    }
  }

  return { perState };
}

function toMarket(city: RawCity, stateCode: string): MarketCsvRow | null {
  const name = (city.name ?? '').trim();
  const state = normalizeState(stateCode);
  const latitude = Number(city.latitude);
  const longitude = Number(city.longitude);
  if (!name || !state || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const marketName = `${name} Farmers Market`;
  return {
    external_id: `city:${city.id}`,
    name: marketName,
    description: `Community farmers market serving ${name}, ${state}. Confirm hours and vendors with local organizers.`,
    organizer_name: `${name} Market Association`,
    address: '',
    city: name,
    state,
    zipcode: '',
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    day_of_week: 'saturday',
    start_hour: 8,
    end_hour: 13,
    parking_info: 'Check with the market for parking details.',
    admission_info: 'Free admission.',
    source: 'dr5hn-cities',
  };
}

async function main(): Promise<void> {
  const { perState } = parseArgs();

  console.log('Downloading US city data...');

  const res = await fetch(CITIES_URL, {
    headers: { 'User-Agent': 'RootedMarketSeeder/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to download city data: HTTP ${res.status}`);
  }

  const countries = (await res.json()) as RawCountry[];
  const us = countries.find((c) => (c.iso2 ?? '').toUpperCase() === 'US');
  if (!us?.states?.length) {
    throw new Error('US states not found in dataset');
  }

  const rows: MarketCsvRow[] = [];

  for (const state of us.states) {
    const stateCode = state.iso2 ?? '';
    const cities = state.cities ?? [];
    const slice = perState != null && perState > 0 ? cities.slice(0, perState) : cities;

    for (const city of slice) {
      const row = toMarket(city, stateCode);
      if (row) rows.push(row);
    }
  }

  const deduped = dedupeMarkets(rows);
  writeFileSync(OUTPUT, marketsToCsv(deduped), 'utf8');

  console.log(`✔ Wrote ${deduped.length} city markets to ${OUTPUT}`);
  console.log(`  States covered: ${us.states.length}`);
  console.log('\nNext: npm run markets:merge && npm run markets:import');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

/**
 * seedMarkets.ts
 *
 * Fetches all five USDA Local Food Directory APIs (farmers markets, CSA,
 * on-farm markets, food hubs, agritourism) — one request per US state per
 * directory — and writes `market-seed-data.json`.
 *
 * API docs: https://www.usdalocalfoodportal.com/fe/datasharing/
 *
 * Run: npm run markets:usda:seed
 */

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { dedupeByLocation, marketTypePriority } from './lib/market-dedupe';
import {
  marketTypeForDirectory,
  usdaCompositeId,
  USDA_DIRECTORIES,
  type UsdaDirectorySlug,
} from './lib/usda-directories';

function loadRootEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, '').replace(/\r$/, '').trim();
    if (!process.env[key] || key === 'USDA_API_KEY') {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

const OUTPUT_FILE = resolve(process.cwd(), 'market-seed-data.json');

const USDA_REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  Referer: 'https://www.usdalocalfoodportal.com/',
};

const REQUEST_DELAY_MS = 150;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: 'al', name: 'Alabama' },
  { abbr: 'ak', name: 'Alaska' },
  { abbr: 'az', name: 'Arizona' },
  { abbr: 'ar', name: 'Arkansas' },
  { abbr: 'ca', name: 'California' },
  { abbr: 'co', name: 'Colorado' },
  { abbr: 'ct', name: 'Connecticut' },
  { abbr: 'de', name: 'Delaware' },
  { abbr: 'fl', name: 'Florida' },
  { abbr: 'ga', name: 'Georgia' },
  { abbr: 'hi', name: 'Hawaii' },
  { abbr: 'id', name: 'Idaho' },
  { abbr: 'il', name: 'Illinois' },
  { abbr: 'in', name: 'Indiana' },
  { abbr: 'ia', name: 'Iowa' },
  { abbr: 'ks', name: 'Kansas' },
  { abbr: 'ky', name: 'Kentucky' },
  { abbr: 'la', name: 'Louisiana' },
  { abbr: 'me', name: 'Maine' },
  { abbr: 'md', name: 'Maryland' },
  { abbr: 'ma', name: 'Massachusetts' },
  { abbr: 'mi', name: 'Michigan' },
  { abbr: 'mn', name: 'Minnesota' },
  { abbr: 'ms', name: 'Mississippi' },
  { abbr: 'mo', name: 'Missouri' },
  { abbr: 'mt', name: 'Montana' },
  { abbr: 'ne', name: 'Nebraska' },
  { abbr: 'nv', name: 'Nevada' },
  { abbr: 'nh', name: 'New Hampshire' },
  { abbr: 'nj', name: 'New Jersey' },
  { abbr: 'nm', name: 'New Mexico' },
  { abbr: 'ny', name: 'New York' },
  { abbr: 'nc', name: 'North Carolina' },
  { abbr: 'nd', name: 'North Dakota' },
  { abbr: 'oh', name: 'Ohio' },
  { abbr: 'ok', name: 'Oklahoma' },
  { abbr: 'or', name: 'Oregon' },
  { abbr: 'pa', name: 'Pennsylvania' },
  { abbr: 'ri', name: 'Rhode Island' },
  { abbr: 'sc', name: 'South Carolina' },
  { abbr: 'sd', name: 'South Dakota' },
  { abbr: 'tn', name: 'Tennessee' },
  { abbr: 'tx', name: 'Texas' },
  { abbr: 'ut', name: 'Utah' },
  { abbr: 'vt', name: 'Vermont' },
  { abbr: 'va', name: 'Virginia' },
  { abbr: 'wa', name: 'Washington' },
  { abbr: 'wv', name: 'West Virginia' },
  { abbr: 'wi', name: 'Wisconsin' },
  { abbr: 'wy', name: 'Wyoming' },
  { abbr: 'dc', name: 'District of Columbia' },
];

interface UsdaMarketRecord {
  listing_id?: string | number;
  listing_name?: string;
  listing_desc?: string | null;
  brief_desc?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  media_website?: string | null;
  media_facebook?: string | null;
  media_instagram?: string | null;
  media_twitter?: string | null;
  location_address?: string | null;
  location_street?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  location_zipcode?: string | null;
  location_x?: string | number;
  location_y?: string | number;
  updatetime?: string | null;
}

interface CleanMarket {
  id: string;
  directory: UsdaDirectorySlug;
  market_type: string;
  name: string;
  website: string;
  street: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number | null;
  longitude: number | null;
  listing_desc: string;
  brief_desc: string;
  location_address: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  media_facebook: string;
  media_instagram: string;
  media_twitter: string;
  usda_updated: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (text === '' || text.toLowerCase() === 'null' || text.toLowerCase() === 'n/a') {
    return fallback;
  }
  return text;
}

function recordRichness(record: CleanMarket): number {
  let score = 0;
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) score += 1;
    else if (typeof value === 'number' && Number.isFinite(value)) score += 1;
  }
  return score;
}

function cleanMarketScore(record: CleanMarket): number {
  return recordRichness(record) + marketTypePriority(record.market_type);
}

function dedupeRecords(records: CleanMarket[]): CleanMarket[] {
  const byId = new Map<string, CleanMarket>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (!existing || recordRichness(record) > recordRichness(existing)) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

function cleanWebsite(value: unknown): string {
  const raw = cleanString(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.includes('.')) return '';
  return `https://${raw}`;
}

function cleanCoord(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) && num !== 0 ? num : null;
}

function mapRecord(
  raw: UsdaMarketRecord,
  directory: UsdaDirectorySlug,
  state: string,
  index: number,
): CleanMarket {
  const listingId = cleanString(raw.listing_id, `${state}-${index}`);
  return {
    id: usdaCompositeId(directory, listingId),
    directory,
    market_type: marketTypeForDirectory(directory),
    name: cleanString(raw.listing_name, 'Unknown Listing'),
    website: cleanWebsite(raw.media_website),
    street: cleanString(raw.location_street),
    city: cleanString(raw.location_city),
    state: cleanString(raw.location_state, state.toUpperCase()),
    zipcode: cleanString(raw.location_zipcode),
    latitude: cleanCoord(raw.location_y),
    longitude: cleanCoord(raw.location_x),
    listing_desc: cleanString(raw.listing_desc),
    brief_desc: cleanString(raw.brief_desc),
    location_address: cleanString(raw.location_address),
    contact_name: cleanString(raw.contact_name),
    contact_email: cleanString(raw.contact_email),
    contact_phone: cleanString(raw.contact_phone),
    media_facebook: cleanString(raw.media_facebook),
    media_instagram: cleanString(raw.media_instagram),
    media_twitter: cleanString(raw.media_twitter),
    usda_updated: cleanString(raw.updatetime),
  };
}

function extractRecords(payload: unknown): UsdaMarketRecord[] {
  if (Array.isArray(payload)) return payload as UsdaMarketRecord[];
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) return data as UsdaMarketRecord[];
  }
  return [];
}

async function fetchStateDirectory(
  directory: UsdaDirectorySlug,
  abbr: string,
  apiKey: string,
): Promise<UsdaMarketRecord[]> {
  const url = `https://www.usdalocalfoodportal.com/api/${directory}/?apikey=${encodeURIComponent(apiKey)}&state=${encodeURIComponent(abbr)}`;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: USDA_REQUEST_HEADERS });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const payload = await res.json();
      if (payload === 'apikey error' || (typeof payload === 'string' && payload.includes('apikey'))) {
        throw new Error('apikey error — check USDA_API_KEY in Rooted/.env');
      }
      return extractRecords(payload);
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : String(err);
      if (attempt <= MAX_RETRIES) {
        console.warn(`  ⚠ attempt ${attempt} failed (${message}); retrying...`);
        await sleep(REQUEST_DELAY_MS * attempt * 2);
      } else {
        throw new Error(message);
      }
    }
  }
  return [];
}

function parseDirectoryFilter(argv: string[]): UsdaDirectorySlug[] | null {
  const flag = argv.find((arg) => arg.startsWith('--directory='));
  if (!flag) return null;
  const value = flag.split('=')[1]?.trim() as UsdaDirectorySlug;
  if (!USDA_DIRECTORIES.some((item) => item.slug === value)) {
    throw new Error(`Unknown directory "${value}". Use one of: ${USDA_DIRECTORIES.map((d) => d.slug).join(', ')}`);
  }
  return [value];
}

async function main(): Promise<void> {
  const apiKey = process.env.USDA_API_KEY?.trim().replace(/\r$/, '') ?? '';
  const placeholders = new Set(['', 'paste_your_key_here', 'your_usda_api_key_here']);
  if (placeholders.has(apiKey)) {
    console.error('✖ Missing USDA_API_KEY in Rooted/.env');
    process.exit(1);
  }

  const directories = parseDirectoryFilter(process.argv.slice(2)) ?? USDA_DIRECTORIES.map((d) => d.slug);
  const totals: Record<string, number> = {};

  console.log(
    `Fetching ${directories.length} USDA director${directories.length === 1 ? 'y' : 'ies'} × ${US_STATES.length} states...\n`,
  );

  const all: CleanMarket[] = [];
  const failures: { directory: string; state: string; error: string }[] = [];

  for (const directory of directories) {
    const label = USDA_DIRECTORIES.find((item) => item.slug === directory)?.label ?? directory;
    console.log(`\n── ${label} (${directory}) ──`);

    for (const { abbr, name } of US_STATES) {
      process.stdout.write(`  ${name}... `);
      try {
        const records = await fetchStateDirectory(directory, abbr, apiKey);
        const cleaned = records.map((r, i) => mapRecord(r, directory, abbr, i));
        all.push(...cleaned);
        totals[directory] = (totals[directory] ?? 0) + cleaned.length;
        console.log(`${cleaned.length}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ directory, state: name, error: message });
        console.log(`ERROR (${message})`);
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  all.sort(
    (a, b) =>
      a.directory.localeCompare(b.directory) ||
      a.state.localeCompare(b.state) ||
      a.name.localeCompare(b.name),
  );

  const byId = dedupeRecords(all);
  const deduped = dedupeByLocation(byId, cleanMarketScore);

  await writeFile(OUTPUT_FILE, JSON.stringify(deduped, null, 2), 'utf8');

  console.log('\n────────────────────────────────────────');
  console.log(`✔ Wrote ${deduped.length} unique listings to ${OUTPUT_FILE}`);
  if (all.length !== deduped.length) {
    console.log(`  (${all.length - deduped.length} duplicate rows merged by id or location)`);
  }
  for (const directory of directories) {
    const count = deduped.filter((row) => row.directory === directory).length;
    console.log(`  ${directory}: ${count} unique`);
  }
  const withCoords = deduped.filter((row) => row.latitude != null && row.longitude != null).length;
  console.log(`  With coordinates: ${withCoords} (${deduped.length - withCoords} skipped on import)`);
  if (failures.length > 0) {
    console.log(`⚠ ${failures.length} request(s) failed — re-run seed to fill gaps`);
  }
  console.log('\nNext: npm run markets:usda:schedules && npm run markets:usda:import && npm run markets:usda:apply');
  console.log('────────────────────────────────────────');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

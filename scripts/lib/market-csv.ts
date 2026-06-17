import { readFileSync } from 'node:fs';

import { dedupeMarketRows } from './market-dedupe';

export interface MarketCsvRow {
  external_id: string;
  name: string;
  description: string;
  organizer_name: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  latitude: number;
  longitude: number;
  day_of_week: string;
  start_hour: number;
  end_hour: number;
  parking_info: string;
  admission_info: string;
  source: string;
  website?: string;
  hours_summary?: string;
  opening_hours?: string;
  seasonal_schedule?: string | null;
  runs_on_days?: string[];
  schedule_source?: string;
  extra_info?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  market_type?: string;
  facebook_url?: string | null;
  instagram_url?: string | null;
}

export const CSV_HEADERS = [
  'external_id',
  'name',
  'description',
  'organizer_name',
  'address',
  'city',
  'state',
  'zipcode',
  'latitude',
  'longitude',
  'day_of_week',
  'start_hour',
  'end_hour',
  'parking_info',
  'admission_info',
  'source',
] as const;

const WEEKDAYS = new Set([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]);

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }

  result.push(current);
  return result;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

function parseNumber(value: string, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizeState(value: string): string {
  const raw = clean(value).toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return STATE_NAME_TO_ABBR[raw.toLowerCase()] ?? raw.slice(0, 2);
}

export function rowToCsv(row: MarketCsvRow): string {
  const values = CSV_HEADERS.map((key) => {
    const raw = String(row[key] ?? '');
    if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  });
  return values.join(',');
}

export function marketsToCsv(rows: MarketCsvRow[]): string {
  return [CSV_HEADERS.join(','), ...rows.map(rowToCsv)].join('\n') + '\n';
}

export function parseMarketsCsv(text: string): MarketCsvRow[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const index = new Map(header.map((h, i) => [h, i]));

  const required = ['name', 'city', 'state', 'latitude', 'longitude'];
  for (const key of required) {
    if (!index.has(key)) {
      throw new Error(`CSV missing required column: ${key}`);
    }
  }

  const rows: MarketCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const get = (key: string) => clean(cols[index.get(key) ?? -1]);

    const name = get('name');
    const city = get('city');
    const state = normalizeState(get('state'));
    const latitude = parseNumber(get('latitude'), NaN);
    const longitude = parseNumber(get('longitude'), NaN);

    if (!name || !city || !state || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    const day = get('day_of_week').toLowerCase() || 'saturday';
    const day_of_week = WEEKDAYS.has(day) ? day : 'saturday';

    rows.push({
      external_id: get('external_id'),
      name,
      description: get('description'),
      organizer_name: get('organizer_name'),
      address: get('address'),
      city,
      state,
      zipcode: get('zipcode'),
      latitude,
      longitude,
      day_of_week,
      start_hour: Math.min(23, Math.max(0, parseNumber(get('start_hour'), 8))),
      end_hour: Math.min(23, Math.max(1, parseNumber(get('end_hour'), 13))),
      parking_info: get('parking_info'),
      admission_info: get('admission_info') || 'Free admission.',
      source: get('source'),
    });
  }

  return rows;
}

export function readMarketsCsv(path: string): MarketCsvRow[] {
  return parseMarketsCsv(readFileSync(path, 'utf8'));
}

export function dedupeMarkets(rows: MarketCsvRow[]): MarketCsvRow[] {
  return dedupeMarketRows(rows);
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

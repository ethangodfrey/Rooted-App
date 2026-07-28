import { describe, expect, it } from 'vitest';

import type { MarketCsvRow } from './market-csv';
import {
  dedupeByLocation,
  dedupeMarketRows,
  marketLocationKey,
  marketRowRichness,
  marketTypePriority,
  normalizeCity,
  normalizeMarketName,
} from './market-dedupe';

function csvRow(overrides: Partial<MarketCsvRow> = {}): MarketCsvRow {
  return {
    external_id: '',
    name: 'Springfield Farmers Market',
    description: '',
    organizer_name: '',
    address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zipcode: '62701',
    latitude: 39.78,
    longitude: -89.65,
    day_of_week: 'Saturday',
    start_hour: 8,
    end_hour: 13,
    parking_info: '',
    admission_info: '',
    source: 'usda',
    ...overrides,
  };
}

describe('normalizeMarketName', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeMarketName("Farmer's Market & Co.")).toBe('farmers market and co');
    expect(normalizeMarketName('  Downtown   Market  ')).toBe('downtown market');
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeMarketName('')).toBe('');
    expect(normalizeMarketName('   ')).toBe('');
  });
});

describe('normalizeCity', () => {
  it('lowercases and trims city names', () => {
    expect(normalizeCity('  Springfield  ')).toBe('springfield');
    expect(normalizeCity('New   York')).toBe('new york');
  });
});

describe('marketLocationKey', () => {
  it('builds a stable key from normalized name, city, state, and zip prefix', () => {
    const key = marketLocationKey("Farmer's Market", 'Springfield', 'Illinois', '62701-1234');
    expect(key).toBe('farmers market|springfield|IL|62701');
  });

  it('handles missing zipcodes', () => {
    expect(marketLocationKey('Market', 'City', 'IL', null)).toBe('market|city|IL|');
  });
});

describe('marketTypePriority', () => {
  it('ranks farmers markets above local businesses', () => {
    expect(marketTypePriority('farmers_market')).toBeGreaterThan(marketTypePriority('local_business'));
  });

  it('returns a default priority for unknown or empty types', () => {
    expect(marketTypePriority(undefined)).toBe(50);
    expect(marketTypePriority('unknown_type')).toBe(30);
  });
});

describe('marketRowRichness', () => {
  it('scores richer rows higher than sparse duplicates', () => {
    const sparse = csvRow({ description: '', hours_summary: '', website: '' });
    const rich = csvRow({
      description: 'Weekly produce',
      hours_summary: 'Sat 8am-1pm',
      website: 'https://example.com',
      extra_info: 'Parking available',
    });
    expect(marketRowRichness(rich)).toBeGreaterThan(marketRowRichness(sparse));
  });
});

describe('dedupeByLocation', () => {
  it('keeps the highest-scoring row per location key', () => {
    const weaker = csvRow({ name: 'Springfield Farmers Market', market_type: 'local_business' });
    const stronger = csvRow({
      name: "Springfield Farmer's Market",
      market_type: 'farmers_market',
      hours_summary: 'Sat 8am-1pm',
    });

    const result = dedupeByLocation([weaker, stronger], marketRowRichness);
    expect(result).toHaveLength(1);
    expect(result[0].market_type).toBe('farmers_market');
  });
});

describe('dedupeMarketRows', () => {
  it('dedupes by external_id first, then by location', () => {
    const duplicateExternal = csvRow({
      external_id: 'usda-1',
      name: 'Alpha Market',
      city: 'Chicago',
      state: 'IL',
      zipcode: '60601',
      hours_summary: 'Sat 8am',
    });
    const sameExternalWeaker = csvRow({
      external_id: 'usda-1',
      name: 'Alpha Market',
      city: 'Chicago',
      state: 'IL',
      zipcode: '60601',
    });
    const differentLocation = csvRow({
      external_id: 'usda-2',
      name: 'Beta Market',
      city: 'Peoria',
      state: 'IL',
      zipcode: '61602',
    });

    const result = dedupeMarketRows([sameExternalWeaker, duplicateExternal, differentLocation]);
    expect(result).toHaveLength(2);
    expect(result.find((row) => row.external_id === 'usda-1')?.hours_summary).toBe('Sat 8am');
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeMarketRows([])).toEqual([]);
  });
});

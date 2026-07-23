import {
  dedupeByLocation,
  dedupeMarketRows,
  marketLocationKey,
  marketRowRichness,
  marketTypePriority,
  normalizeCity,
  normalizeMarketName,
} from '../../scripts/lib/market-dedupe';
import type { MarketCsvRow } from '../../scripts/lib/market-csv';

function row(overrides: Partial<MarketCsvRow> = {}): MarketCsvRow {
  return {
    external_id: '',
    name: 'Downtown Farmers Market',
    description: '',
    organizer_name: '',
    address: '',
    city: 'Chicago',
    state: 'IL',
    zipcode: '60601',
    latitude: 0,
    longitude: 0,
    day_of_week: '',
    start_hour: 0,
    end_hour: 0,
    parking_info: '',
    admission_info: '',
    source: 'test',
    market_type: 'farmers_market',
    website: '',
    hours_summary: '',
    extra_info: '',
    ...overrides,
  };
}

describe('normalizeMarketName', () => {
  it('lowercases, strips accents, and collapses punctuation', () => {
    expect(normalizeMarketName("O'Brien's Farmers & Artisan Market")).toBe(
      'o brien s farmers and artisan market',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeMarketName('   ')).toBe('');
  });
});

describe('normalizeCity', () => {
  it('lowercases and trims city names', () => {
    expect(normalizeCity('  Chicago  ')).toBe('chicago');
    expect(normalizeCity('St   Paul')).toBe('st paul');
  });
});

describe('marketLocationKey', () => {
  it('builds a stable key from normalized name, city, state, and zip prefix', () => {
    expect(marketLocationKey('Downtown Farmers Market', 'Chicago', 'il', '60601-1234')).toBe(
      'downtown farmers market|chicago|IL|60601',
    );
  });

  it('handles missing zipcode', () => {
    expect(marketLocationKey('River Market', 'Kansas City', 'MO', null)).toBe(
      'river market|kansas city|MO|',
    );
  });
});

describe('marketTypePriority', () => {
  it('ranks known market types by priority', () => {
    expect(marketTypePriority('farmers_market')).toBeGreaterThan(
      marketTypePriority('farm_stand'),
    );
    expect(marketTypePriority('on_farm_market')).toBe(80);
  });

  it('returns default priority for null, undefined, or unknown types', () => {
    expect(marketTypePriority(null)).toBe(50);
    expect(marketTypePriority(undefined)).toBe(50);
    expect(marketTypePriority('unknown_type')).toBe(30);
  });
});

describe('marketRowRichness', () => {
  it('scores populated fields and boosts descriptive metadata', () => {
    const sparse = row({ description: '', hours_summary: '', website: '' });
    const rich = row({
      description: 'Weekly produce market',
      hours_summary: 'Sat 8am-1pm',
      website: 'https://example.com',
      extra_info: 'Parking in rear',
    });

    expect(marketRowRichness(rich)).toBeGreaterThan(marketRowRichness(sparse));
  });
});

describe('dedupeByLocation', () => {
  it('keeps the highest-scoring row per location key', () => {
    const rows = [
      row({ name: 'Downtown Market', description: 'Short' }),
      row({
        name: 'Downtown Market',
        description: 'Longer description with more detail for scoring',
        website: 'https://downtown.test',
      }),
    ];

    const deduped = dedupeByLocation(rows, marketRowRichness);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.website).toBe('https://downtown.test');
  });
});

describe('dedupeMarketRows', () => {
  it('dedupes by external_id first, then by location', () => {
    const rows = [
      row({ external_id: 'usda-1', name: 'Alpha Market', city: 'Austin', state: 'TX' }),
      row({ external_id: 'usda-1', name: 'Alpha Market Updated', city: 'Austin', state: 'TX' }),
      row({ name: 'Beta Market', city: 'Dallas', state: 'TX' }),
      row({ name: 'Beta Market', city: 'Dallas', state: 'TX', website: 'https://beta.test' }),
    ];

    const deduped = dedupeMarketRows(rows);
    expect(deduped).toHaveLength(2);

    const alpha = deduped.find((r) => r.city === 'Austin');
    const beta = deduped.find((r) => r.city === 'Dallas');

    expect(alpha?.name).toBe('Alpha Market Updated');
    expect(beta?.website).toBe('https://beta.test');
  });

  it('skips rows without external_id when building the external-id map', () => {
    const rows = [
      row({ external_id: '', name: 'Solo Market', city: 'Omaha', state: 'NE' }),
      row({ external_id: '', name: 'Solo Market', city: 'Omaha', state: 'NE' }),
    ];

    expect(dedupeMarketRows(rows)).toHaveLength(1);
  });
});

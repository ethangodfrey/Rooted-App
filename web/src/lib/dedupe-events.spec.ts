import { describe, expect, it } from 'vitest';

import type { Event } from '@/types/database';

import { dedupeEvents } from './dedupe-events';

function market(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    name: "Farmer's Market",
    city: 'Springfield',
    state: 'IL',
    market_type: 'farmers_market',
    hours_summary: null,
    address: null,
    banner_url: null,
    sync_metadata: null,
    ...overrides,
  } as Event;
}

describe('dedupeEvents', () => {
  it('returns a single event when there are no duplicates', () => {
    const events = [market({ id: 'a' }), market({ id: 'b', name: 'Other Market' })];
    expect(dedupeEvents(events)).toHaveLength(2);
  });

  it('collapses duplicate markets by normalized name + city + state', () => {
    const weaker = market({
      id: 'weak',
      market_type: 'local_business',
      hours_summary: null,
      address: null,
      sync_metadata: { zipcode: '62701' },
    });
    const stronger = market({
      id: 'strong',
      market_type: 'farmers_market',
      hours_summary: 'Sat 8am–1pm',
      address: '123 Main St',
      sync_metadata: { zipcode: '62701' },
    });

    const result = dedupeEvents([weaker, stronger]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('strong');
  });

  it('treats punctuation and casing variants as the same market', () => {
    const a = market({ id: 'a', name: "Farmer's Market" });
    const b = market({ id: 'b', name: 'Farmers Market' });
    const result = dedupeEvents([a, b]);
    expect(result).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(dedupeEvents([])).toEqual([]);
  });
});

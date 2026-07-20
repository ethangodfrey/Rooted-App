import { describe, expect, it } from 'vitest';

import type { Event } from '@/types/database';

import { eventsForScope, sortEventsByDate, sortEventsByDistance } from './events-list';

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Market',
    city: 'Chicago',
    state: 'IL',
    address: null,
    latitude: 41.8781,
    longitude: -87.6298,
    start_datetime: '2026-07-10T12:00:00.000Z',
    end_datetime: '2026-07-10T18:00:00.000Z',
    timezone: 'America/Chicago',
    event_status: 'scheduled',
    visibility_status: 'public',
    market_type: 'farmers_market',
    hours_summary: null,
    banner_url: null,
    website_url: null,
    extra_info: null,
    sync_metadata: null,
    ...overrides,
  } as Event;
}

describe('sortEventsByDate', () => {
  it('orders events by start_datetime ascending', () => {
    const sorted = sortEventsByDate([
      event({ id: 'late', start_datetime: '2026-07-20T12:00:00.000Z' }),
      event({ id: 'early', start_datetime: '2026-07-01T12:00:00.000Z' }),
    ]);

    expect(sorted.map((e) => e.id)).toEqual(['early', 'late']);
  });

  it('returns an empty array for empty input', () => {
    expect(sortEventsByDate([])).toEqual([]);
  });
});

describe('sortEventsByDistance', () => {
  const chicago = { latitude: 41.8781, longitude: -87.6298 };

  it('orders events by distance from a reference point', () => {
    const sorted = sortEventsByDistance(
      [
        event({ id: 'far', latitude: 43.0389, longitude: -87.9065 }),
        event({ id: 'near', latitude: 41.9, longitude: -87.65 }),
      ],
      chicago,
    );

    expect(sorted[0].id).toBe('near');
    expect(sorted[1].id).toBe('far');
  });

  it('pushes events without valid coordinates to the end', () => {
    const sorted = sortEventsByDistance(
      [
        event({ id: 'invalid', latitude: null as unknown as number, longitude: null as unknown as number }),
        event({ id: 'valid', latitude: 41.9, longitude: -87.65 }),
      ],
      chicago,
    );

    expect(sorted[0].id).toBe('valid');
    expect(sorted[1].id).toBe('invalid');
  });
});

describe('eventsForScope', () => {
  const events = [
    event({ id: 'a', start_datetime: '2026-07-01T12:00:00.000Z', latitude: 43.0, longitude: -87.9 }),
    event({ id: 'b', start_datetime: '2026-07-10T12:00:00.000Z', latitude: 41.9, longitude: -87.65 }),
  ];

  it('sorts by date for nationwide scope', () => {
    const result = eventsForScope(events, 'nationwide', { latitude: 41.8781, longitude: -87.6298 });
    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('sorts by distance for local scope when coords are provided', () => {
    const result = eventsForScope(events, 'local', { latitude: 41.8781, longitude: -87.6298 });
    expect(result[0].id).toBe('b');
  });

  it('falls back to date sorting when local scope has no coords', () => {
    const result = eventsForScope(events, 'local', null);
    expect(result.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

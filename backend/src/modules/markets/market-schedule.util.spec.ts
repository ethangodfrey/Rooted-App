import { DateTime } from 'luxon';

import { inferMarketType, nextMarketWindow, parseOsmOpeningHours } from './market-schedule.util';

function at(iso: string, zone: string): DateTime {
  const dt = DateTime.fromISO(iso, { zone });
  if (!dt.isValid) throw new Error(`Invalid test datetime: ${iso}`);
  return dt;
}

describe('nextMarketWindow', () => {
  const tz = 'America/Chicago';

  it('uses today when the market is currently open', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T10:30:00', tz));

    expect(start.toISOString()).toBe('2026-06-13T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-13T18:00:00.000Z');
  });

  it('uses today when the market has not opened yet', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T07:00:00', tz));

    expect(start.toISOString()).toBe('2026-06-13T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-13T18:00:00.000Z');
  });

  it('uses next week after todays session has ended', () => {
    const { start, end } = nextMarketWindow('saturday', 8, 13, tz, at('2026-06-13T14:00:00', tz));

    expect(start.toISOString()).toBe('2026-06-20T13:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-20T18:00:00.000Z');
  });
});

describe('parseOsmOpeningHours', () => {
  it('returns null for empty input', () => {
    expect(parseOsmOpeningHours(null)).toBeNull();
    expect(parseOsmOpeningHours('')).toBeNull();
    expect(parseOsmOpeningHours('   ')).toBeNull();
  });

  it('parses standard OSM day/time ranges', () => {
    expect(parseOsmOpeningHours('Sa 08:00-13:00')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
      summary: 'Sa 08:00-13:00',
    });
  });

  it('falls back to saturday defaults when pattern does not match', () => {
    expect(parseOsmOpeningHours('by appointment only')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
      summary: 'by appointment only',
    });
  });
});

describe('inferMarketType', () => {
  it('reads explicit OSM marketplace tags', () => {
    expect(inferMarketType('Downtown Market', { marketplace: 'farmers_market' })).toBe(
      'farmers_market',
    );
  });

  it('infers type from name and description text', () => {
    expect(inferMarketType('Sunday Flea Finds', {})).toBe('flea_market');
    expect(inferMarketType('Artisan Makers Fair', { description: 'craft vendors' })).toBe(
      'craft_market',
    );
    expect(inferMarketType('City Farmers Market', {})).toBe('farmers_market');
    expect(inferMarketType('Neighborhood Market', {})).toBe('mixed');
  });

  it('returns unknown when no market signals are present', () => {
    expect(inferMarketType('Community Center', {})).toBe('unknown');
  });
});

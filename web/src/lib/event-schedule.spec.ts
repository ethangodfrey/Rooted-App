import { describe, expect, it, vi } from 'vitest';

import {
  dayNameToIndex,
  parseHumanOpeningHours,
  parseOsmOpeningHours,
  recurringMarketPhase,
  resolveEventTimezone,
} from './event-schedule';

describe('dayNameToIndex', () => {
  it('maps full weekday names and abbreviations', () => {
    expect(dayNameToIndex('Saturday')).toBe(6);
    expect(dayNameToIndex('saturdays')).toBe(6);
    expect(dayNameToIndex('Sa')).toBe(6);
  });

  it('returns null for empty or unknown tokens', () => {
    expect(dayNameToIndex('')).toBeNull();
    expect(dayNameToIndex('   ')).toBeNull();
    expect(dayNameToIndex('notaday')).toBeNull();
  });
});

describe('parseHumanOpeningHours', () => {
  it('parses common farmers market summaries', () => {
    expect(parseHumanOpeningHours('Saturdays 8am–1pm')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('returns null for empty or missing summaries', () => {
    expect(parseHumanOpeningHours(null)).toBeNull();
    expect(parseHumanOpeningHours('')).toBeNull();
    expect(parseHumanOpeningHours('   ')).toBeNull();
  });

  it('falls back to default hours when times are absent', () => {
    expect(parseHumanOpeningHours('Every Sunday')).toEqual({
      dayOfWeek: 'sunday',
      startHour: 8,
      endHour: 13,
    });
  });
});

describe('parseOsmOpeningHours', () => {
  it('parses OSM-style weekday ranges', () => {
    expect(parseOsmOpeningHours('Sa 08:00-13:00')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('returns null for undefined or blank input', () => {
    expect(parseOsmOpeningHours(undefined)).toBeNull();
    expect(parseOsmOpeningHours('closed')).toBeNull();
  });
});

describe('resolveEventTimezone', () => {
  it('prefers explicit IANA timezone when provided', () => {
    expect(resolveEventTimezone({ timezone: 'America/Chicago', state: 'IL' })).toBe(
      'America/Chicago',
    );
  });

  it('maps state abbreviations to a default timezone', () => {
    expect(resolveEventTimezone({ state: 'CA' })).toBe('America/Los_Angeles');
    expect(resolveEventTimezone({ state: 'NY' })).toBe('America/New_York');
  });

  it('falls back to Eastern when state is missing', () => {
    expect(resolveEventTimezone({})).toBe('America/New_York');
  });
});

describe('recurringMarketPhase', () => {
  it('returns live during operating hours on the scheduled weekday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T14:00:00.000Z')); // Saturday morning in Chicago

    const phase = recurringMarketPhase(
      { dayOfWeek: 'saturday', startHour: 8, endHour: 13 },
      'America/Chicago',
      new Date('2026-07-11T14:00:00.000Z'),
      [6],
    );

    expect(phase).toBe('live');
    vi.useRealTimers();
  });

  it('returns upcoming outside operating hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T22:00:00.000Z'));

    const phase = recurringMarketPhase(
      { dayOfWeek: 'saturday', startHour: 8, endHour: 13 },
      'America/Chicago',
      new Date('2026-07-11T22:00:00.000Z'),
      [6],
    );

    expect(phase).toBe('upcoming');
    vi.useRealTimers();
  });
});

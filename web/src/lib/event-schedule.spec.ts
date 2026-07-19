import { describe, expect, it, vi } from 'vitest';

import {
  dayNameToIndex,
  formatWeekdayLabel,
  getZonedParts,
  isRecurringMarketEvent,
  msUntilRecurringMarketOpens,
  nextOperatingDayName,
  parseHumanOpeningHours,
  parseOsmOpeningHours,
  recurringMarketPhase,
  resolveEventDisplayInstant,
  resolveEventSchedule,
  resolveEventTimezone,
  resolveOperatingDayIndices,
} from './event-schedule';

describe('dayNameToIndex', () => {
  it('maps full weekday names and abbreviations', () => {
    expect(dayNameToIndex('saturday')).toBe(6);
    expect(dayNameToIndex('Saturdays')).toBe(6);
    expect(dayNameToIndex('sa')).toBe(6);
    expect(dayNameToIndex('Monday')).toBe(1);
    expect(dayNameToIndex('tu')).toBe(2);
  });

  it('returns null for empty, unknown, or whitespace-only input', () => {
    expect(dayNameToIndex('')).toBeNull();
    expect(dayNameToIndex('   ')).toBeNull();
    expect(dayNameToIndex('notaday')).toBeNull();
    expect(dayNameToIndex('fundays')).toBeNull();
  });
});

describe('parseOsmOpeningHours', () => {
  it('returns null for empty or undefined input', () => {
    expect(parseOsmOpeningHours(null)).toBeNull();
    expect(parseOsmOpeningHours(undefined)).toBeNull();
    expect(parseOsmOpeningHours('')).toBeNull();
    expect(parseOsmOpeningHours('   ')).toBeNull();
  });

  it('parses standard OSM day/time ranges', () => {
    expect(parseOsmOpeningHours('Sa 08:00-13:00')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
    expect(parseOsmOpeningHours('Mo 09:30-14:00')).toEqual({
      dayOfWeek: 'monday',
      startHour: 9,
      endHour: 14,
    });
  });

  it('returns null when the pattern does not match', () => {
    expect(parseOsmOpeningHours('by appointment only')).toBeNull();
    expect(parseOsmOpeningHours('open daily')).toBeNull();
  });
});

describe('parseHumanOpeningHours', () => {
  it('returns null for empty or undefined input', () => {
    expect(parseHumanOpeningHours(null)).toBeNull();
    expect(parseHumanOpeningHours(undefined)).toBeNull();
    expect(parseHumanOpeningHours('')).toBeNull();
    expect(parseHumanOpeningHours('   ')).toBeNull();
  });

  it('parses human summaries with explicit am/pm ranges', () => {
    expect(parseHumanOpeningHours('Saturdays 8am–1pm')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
    expect(parseHumanOpeningHours('Sunday 10:30am - 2:45pm')).toEqual({
      dayOfWeek: 'sunday',
      startHour: 10,
      endHour: 15,
    });
  });

  it('falls back to default hours when day is present but time range is missing', () => {
    expect(parseHumanOpeningHours('Fridays')).toEqual({
      dayOfWeek: 'friday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('returns null when no weekday is found', () => {
    expect(parseHumanOpeningHours('8am–1pm')).toBeNull();
  });
});

describe('resolveEventSchedule', () => {
  it('prefers explicit metadata hours over parsed opening_hours text', () => {
    expect(
      resolveEventSchedule({
        opening_hours: 'Sa 08:00-13:00',
        start_hour: 9,
        end_hour: 14,
        typical_day: 'saturday',
      }),
    ).toEqual({
      dayOfWeek: 'saturday',
      startHour: 9,
      endHour: 14,
    });
  });

  it('uses parsed opening_hours when metadata hours are absent', () => {
    expect(
      resolveEventSchedule({
        opening_hours: 'Sa 08:00-13:00',
      }),
    ).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('defaults to saturday 8–13 when metadata is empty', () => {
    expect(resolveEventSchedule({})).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });
});

describe('resolveEventTimezone', () => {
  it('returns explicit IANA timezone when provided', () => {
    expect(resolveEventTimezone({ timezone: 'America/Chicago' })).toBe('America/Chicago');
  });

  it('maps US state abbreviations to default timezones', () => {
    expect(resolveEventTimezone({ state: 'CA' })).toBe('America/Los_Angeles');
    expect(resolveEventTimezone({ state: 'IL' })).toBe('America/Chicago');
    expect(resolveEventTimezone({ state: 'NY' })).toBe('America/New_York');
  });

  it('falls back to America/New_York for unknown states', () => {
    expect(resolveEventTimezone({ state: 'ZZ' })).toBe('America/New_York');
    expect(resolveEventTimezone({})).toBe('America/New_York');
  });
});

describe('isRecurringMarketEvent', () => {
  it('detects recurring markets from sync_metadata fields', () => {
    expect(isRecurringMarketEvent({ sync_metadata: { opening_hours: 'Sa 08:00-13:00' } })).toBe(
      true,
    );
    expect(isRecurringMarketEvent({ sync_metadata: { runs_on_days: ['saturday'] } })).toBe(true);
  });

  it('detects recurring markets from hours_summary text', () => {
    expect(isRecurringMarketEvent({ hours_summary: 'Saturdays 8am–1pm' })).toBe(true);
  });

  it('returns false for one-off events without schedule signals', () => {
    expect(isRecurringMarketEvent({ hours_summary: null })).toBe(false);
    expect(isRecurringMarketEvent({})).toBe(false);
  });
});

describe('resolveOperatingDayIndices', () => {
  it('reads runs_on_days from metadata when present', () => {
    expect(
      resolveOperatingDayIndices({
        sync_metadata: { runs_on_days: ['saturday', 'sunday'] },
      }),
    ).toEqual([0, 6]);
  });

  it('falls back to parsed hours_summary weekday', () => {
    expect(
      resolveOperatingDayIndices({
        hours_summary: 'Sa 08:00-13:00',
      }),
    ).toEqual([6]);
  });
});

describe('getZonedParts', () => {
  it('returns weekday and wall-clock parts in the target timezone', () => {
    const parts = getZonedParts(new Date('2026-06-13T15:30:00.000Z'), 'America/Chicago');
    expect(parts.weekday).toBe(6);
    expect(parts.hour).toBeGreaterThanOrEqual(0);
    expect(parts.minute).toBeGreaterThanOrEqual(0);
  });
});

describe('recurringMarketPhase', () => {
  const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

  it('returns live during operating hours on an operating day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T15:00:00.000Z'));
    const phase = recurringMarketPhase(schedule, 'America/Chicago', new Date(), [6]);
    expect(phase).toBe('live');
    vi.useRealTimers();
  });

  it('returns upcoming outside operating hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T22:00:00.000Z'));
    const phase = recurringMarketPhase(schedule, 'America/Chicago', new Date(), [6]);
    expect(phase).toBe('upcoming');
    vi.useRealTimers();
  });
});

describe('msUntilRecurringMarketOpens', () => {
  const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

  it('returns zero when the market is currently live', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T15:00:00.000Z'));
    expect(msUntilRecurringMarketOpens(schedule, 'America/Chicago', new Date(), [6])).toBe(0);
    vi.useRealTimers();
  });

  it('returns a positive delay before the session opens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z'));
    const ms = msUntilRecurringMarketOpens(schedule, 'America/Chicago', new Date(), [6]);
    expect(ms).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

describe('formatWeekdayLabel', () => {
  it('capitalizes weekday names and strips plural suffixes', () => {
    expect(formatWeekdayLabel('saturday')).toBe('Saturday');
    expect(formatWeekdayLabel('Saturdays')).toBe('Saturday');
  });
});

describe('nextOperatingDayName', () => {
  const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

  it('returns the next operating day after the current weekday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T15:00:00.000Z'));
    const name = nextOperatingDayName(schedule, [6, 0], 'America/Chicago', new Date());
    expect(name).toBe('saturday');
    vi.useRealTimers();
  });
});

describe('resolveEventDisplayInstant', () => {
  it('returns seed start_datetime for one-off events', () => {
    const event = {
      start_datetime: '2026-07-12T14:00:00.000Z',
      hours_summary: null,
      state: 'IL',
    };
    const instant = resolveEventDisplayInstant(event, new Date('2026-07-10T12:00:00.000Z'));
    expect(instant.toISOString()).toBe('2026-07-12T14:00:00.000Z');
  });

  it('uses now for live recurring markets', () => {
    vi.useFakeTimers();
    const now = new Date('2026-06-13T15:00:00.000Z');
    vi.setSystemTime(now);
    const event = {
      start_datetime: '2026-01-01T12:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
    };
    const instant = resolveEventDisplayInstant(event, now);
    expect(instant.getTime()).toBe(now.getTime());
    vi.useRealTimers();
  });
});

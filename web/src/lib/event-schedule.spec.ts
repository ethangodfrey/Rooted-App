import { describe, expect, it } from 'vitest';

import {
  dayNameToIndex,
  formatWeekdayLabel,
  isRecurringMarketEvent,
  msUntilRecurringMarketOpens,
  parseHumanOpeningHours,
  parseOsmOpeningHours,
  recurringMarketPhase,
  resolveEventSchedule,
  resolveEventTimezone,
  resolveOperatingDayIndices,
} from './event-schedule';

describe('dayNameToIndex', () => {
  it('maps full weekday names and abbreviations', () => {
    expect(dayNameToIndex('Saturday')).toBe(6);
    expect(dayNameToIndex('saturdays')).toBe(6);
    expect(dayNameToIndex('Sa')).toBe(6);
    expect(dayNameToIndex('mo')).toBe(1);
  });

  it('returns null for empty or unknown values', () => {
    expect(dayNameToIndex('')).toBeNull();
    expect(dayNameToIndex('   ')).toBeNull();
    expect(dayNameToIndex('funday')).toBeNull();
  });
});

describe('parseHumanOpeningHours', () => {
  it('parses summaries like "Saturdays 8am–1pm"', () => {
    expect(parseHumanOpeningHours('Saturdays 8am–1pm')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('returns null for empty, null, or undefined input', () => {
    expect(parseHumanOpeningHours(null)).toBeNull();
    expect(parseHumanOpeningHours(undefined)).toBeNull();
    expect(parseHumanOpeningHours('')).toBeNull();
    expect(parseHumanOpeningHours('   ')).toBeNull();
  });

  it('returns null when no weekday is present', () => {
    expect(parseHumanOpeningHours('8am-1pm daily')).toBeNull();
  });

  it('falls back to default hours when times are missing', () => {
    expect(parseHumanOpeningHours('Fridays')).toEqual({
      dayOfWeek: 'friday',
      startHour: 8,
      endHour: 13,
    });
  });
});

describe('parseOsmOpeningHours', () => {
  it('parses OSM-style strings like "Sa 08:00-13:00"', () => {
    expect(parseOsmOpeningHours('Sa 08:00-13:00')).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });

  it('returns null for empty or unparseable strings', () => {
    expect(parseOsmOpeningHours('')).toBeNull();
    expect(parseOsmOpeningHours('open daily')).toBeNull();
  });
});

describe('resolveEventSchedule', () => {
  it('prefers sync metadata opening hours and typical day', () => {
    const schedule = resolveEventSchedule({
      opening_hours: 'Sa 08:00-13:00',
      typical_day: 'saturday',
      start_hour: 9,
      end_hour: 14,
    });

    expect(schedule).toMatchObject({
      dayOfWeek: 'saturday',
      startHour: 9,
      endHour: 14,
    });
  });

  it('falls back to Saturday 8-13 when metadata is empty', () => {
    expect(resolveEventSchedule(undefined)).toEqual({
      dayOfWeek: 'saturday',
      startHour: 8,
      endHour: 13,
    });
  });
});

describe('resolveEventTimezone', () => {
  it('uses explicit IANA timezone when provided', () => {
    expect(resolveEventTimezone({ timezone: 'America/Chicago', state: 'IL' })).toBe(
      'America/Chicago',
    );
  });

  it('maps state abbreviations to default timezones', () => {
    expect(resolveEventTimezone({ state: 'CA' })).toBe('America/Los_Angeles');
    expect(resolveEventTimezone({ state: 'ny' })).toBe('America/New_York');
  });

  it('falls back to America/New_York when state is missing or unknown', () => {
    expect(resolveEventTimezone({})).toBe('America/New_York');
    expect(resolveEventTimezone({ state: '' })).toBe('America/New_York');
    expect(resolveEventTimezone({ state: 'ZZ' })).toBe('America/New_York');
  });
});

describe('isRecurringMarketEvent', () => {
  it('detects recurring markets from hours_summary or sync metadata', () => {
    expect(isRecurringMarketEvent({ hours_summary: 'Sa 08:00-13:00' })).toBe(true);
    expect(
      isRecurringMarketEvent({
        sync_metadata: { opening_hours: 'Sa 08:00-13:00' },
      }),
    ).toBe(true);
  });

  it('returns false when no schedule hints exist', () => {
    expect(isRecurringMarketEvent({})).toBe(false);
    expect(isRecurringMarketEvent({ hours_summary: '' })).toBe(false);
  });
});

describe('recurringMarketPhase', () => {
  const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

  it('returns live during operating hours on the scheduled day', () => {
    const saturdayMiddayChicago = new Date('2026-07-11T17:00:00.000Z');
    expect(recurringMarketPhase(schedule, 'America/Chicago', saturdayMiddayChicago)).toBe('live');
  });

  it('returns upcoming outside operating hours', () => {
    const saturdayEveningChicago = new Date('2026-07-12T01:00:00.000Z');
    expect(recurringMarketPhase(schedule, 'America/Chicago', saturdayEveningChicago)).toBe(
      'upcoming',
    );
  });
});

describe('msUntilRecurringMarketOpens', () => {
  it('returns zero while the market is live', () => {
    const saturdayMiddayChicago = new Date('2026-07-11T17:00:00.000Z');
    const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

    expect(msUntilRecurringMarketOpens(schedule, 'America/Chicago', saturdayMiddayChicago)).toBe(0);
  });

  it('returns a positive delay before the next opening', () => {
    const fridayEveningChicago = new Date('2026-07-11T03:00:00.000Z');
    const schedule = { dayOfWeek: 'saturday', startHour: 8, endHour: 13 };

    expect(
      msUntilRecurringMarketOpens(schedule, 'America/Chicago', fridayEveningChicago),
    ).toBeGreaterThan(0);
  });
});

describe('resolveOperatingDayIndices', () => {
  it('returns weekday indices from hours_summary', () => {
    expect(resolveOperatingDayIndices({ hours_summary: 'Sa 08:00-13:00' })).toEqual([6]);
  });
});

describe('formatWeekdayLabel', () => {
  it('capitalizes weekday names', () => {
    expect(formatWeekdayLabel('saturday')).toBe('Saturday');
  });
});

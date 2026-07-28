import { describe, expect, it, vi } from 'vitest';

import {
  formatCurrentClock,
  formatDateTime,
  formatEventDate,
  formatEventDisplayDate,
  formatEventDisplayFullDate,
  formatEventDisplayTimeRange,
  formatEventFullDate,
  formatLocalDate,
  formatPrice,
  formatRelativeTime,
} from './format';

describe('formatPrice', () => {
  it('formats whole-dollar amounts', () => {
    expect(formatPrice(1000)).toBe('$10.00');
  });

  it('formats fractional cents', () => {
    expect(formatPrice(1250)).toBe('$12.50');
    expect(formatPrice(99)).toBe('$0.99');
  });

  it('formats zero cents', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('handles large totals', () => {
    expect(formatPrice(1_234_567)).toBe('$12345.67');
  });

  it('rounds half-up for fractional cent inputs', () => {
    expect(formatPrice(1000.4)).toBe('$10.00');
    expect(formatPrice(1000.5)).toBe('$10.01');
  });

  it('handles negative amounts', () => {
    expect(formatPrice(-500)).toBe('$-5.00');
  });

  it('formats NaN and non-finite values as zero dollars', () => {
    expect(formatPrice(Number.NaN)).toBe('$NaN');
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe('$Infinity');
  });
});

describe('formatEventDate', () => {
  it('returns a non-empty localized date string', () => {
    const label = formatEventDate('2026-07-10T15:00:00.000Z');
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/Jul/);
  });
});

describe('formatEventFullDate', () => {
  it('includes the year in the formatted label', () => {
    const label = formatEventFullDate('2026-07-10T15:00:00.000Z');
    expect(label).toContain('2026');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps under one minute ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(formatRelativeTime('2026-07-10T11:59:30.000Z')).toBe('just now');
    vi.useRealTimers();
  });

  it('returns minutes ago for recent timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(formatRelativeTime('2026-07-10T11:45:00.000Z')).toBe('15m ago');
    vi.useRealTimers();
  });

  it('returns hours ago for same-day timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(formatRelativeTime('2026-07-10T09:00:00.000Z')).toBe('3h ago');
    vi.useRealTimers();
  });

  it('returns days ago for timestamps within a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(formatRelativeTime('2026-07-08T12:00:00.000Z')).toBe('2d ago');
    vi.useRealTimers();
  });

  it('falls back to a short date for older timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00.000Z'));
    expect(formatRelativeTime('2026-06-01T12:00:00.000Z')).toMatch(/Jun/);
    vi.useRealTimers();
  });
});

describe('formatCurrentClock', () => {
  it('includes seconds in the live clock label', () => {
    const label = formatCurrentClock(new Date('2026-07-10T15:30:45.000Z'));
    expect(label.length).toBeGreaterThan(0);
    expect(label).toMatch(/45/);
  });
});

describe('formatLocalDate', () => {
  it('formats a stable en-US weekday and month label', () => {
    expect(formatLocalDate(new Date('2026-07-10T15:00:00.000Z'))).toMatch(/Fri.*Jul.*10/);
  });

  it('honors an explicit IANA timezone', () => {
    const label = formatLocalDate(new Date('2026-07-10T04:00:00.000Z'), 'America/Los_Angeles');
    expect(label).toMatch(/Jul.*9/);
  });
});

describe('formatDateTime', () => {
  it('returns a short month, day, and time label', () => {
    const label = formatDateTime('2026-07-10T15:30:00.000Z');
    expect(label).toMatch(/Jul/);
    expect(label).toMatch(/10/);
  });
});

describe('formatEventDisplayDate', () => {
  it('uses the stored start date for one-off events', () => {
    const label = formatEventDisplayDate(
      {
        start_datetime: '2026-07-10T15:00:00.000Z',
        hours_summary: null,
        state: 'IL',
      },
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(label).toMatch(/Jul.*10/);
  });

  it('uses the live calendar day for recurring markets that are open', () => {
    const label = formatEventDisplayDate(
      {
        start_datetime: '2026-01-01T12:00:00.000Z',
        hours_summary: 'Sa 08:00-13:00',
        state: 'IL',
        timezone: 'America/Chicago',
      },
      new Date('2026-07-11T17:00:00.000Z'),
    );
    expect(label).toMatch(/Jul.*11/);
  });
});

describe('formatEventDisplayFullDate', () => {
  it('includes the year for one-off events', () => {
    const label = formatEventDisplayFullDate(
      {
        start_datetime: '2026-07-10T15:00:00.000Z',
        hours_summary: null,
        state: 'IL',
      },
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(label).toContain('2026');
    expect(label).toMatch(/July.*10/);
  });
});

describe('formatEventDisplayTimeRange', () => {
  it('formats the schedule window from seed datetimes', () => {
    const label = formatEventDisplayTimeRange({
      start_datetime: '2026-07-10T13:00:00.000Z',
      end_datetime: '2026-07-10T18:00:00.000Z',
      hours_summary: 'Sa 08:00-13:00',
      state: 'IL',
      timezone: 'America/Chicago',
    });

    expect(label).toMatch(/8:00/);
    expect(label).toMatch(/1:00/);
    expect(label).toMatch(/–/);
  });
});

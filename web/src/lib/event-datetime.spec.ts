import { describe, expect, it } from 'vitest';

import { combineDateTime, toDateInput, toTimeInput } from './event-datetime';

describe('toDateInput', () => {
  it('formats a local calendar date as YYYY-MM-DD', () => {
    const iso = '2026-07-10T15:30:00.000Z';
    expect(toDateInput(iso)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toDateInput(iso)).toContain('2026');
  });
});

describe('toTimeInput', () => {
  it('formats a local time as HH:MM', () => {
    const iso = '2026-07-10T15:30:00.000Z';
    expect(toTimeInput(iso)).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('combineDateTime', () => {
  it('combines valid date and time into an ISO string', () => {
    const iso = combineDateTime('2026-07-10', '09:30');
    expect(iso).toBeTruthy();
    expect(new Date(iso!).toISOString()).toBe(iso);
  });

  it('returns null for empty or whitespace-only inputs', () => {
    expect(combineDateTime('', '09:30')).toBeNull();
    expect(combineDateTime('2026-07-10', '')).toBeNull();
    expect(combineDateTime('   ', '09:30')).toBeNull();
    expect(combineDateTime('2026-07-10', '   ')).toBeNull();
  });

  it('returns null for invalid date/time combinations', () => {
    expect(combineDateTime('not-a-date', '09:30')).toBeNull();
    expect(combineDateTime('2026-13-40', '99:99')).toBeNull();
  });
});

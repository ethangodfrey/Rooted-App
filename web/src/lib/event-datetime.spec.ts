import { describe, expect, it } from 'vitest';

import { combineDateTime, toDateInput, toTimeInput } from './event-datetime';

describe('toDateInput', () => {
  it('formats a local calendar date as YYYY-MM-DD', () => {
    expect(toDateInput('2026-07-10T15:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toTimeInput', () => {
  it('formats a local time as HH:MM', () => {
    const label = toTimeInput('2026-07-10T15:30:00.000Z');
    expect(label).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('combineDateTime', () => {
  it('combines valid date and time into an ISO string', () => {
    const iso = combineDateTime('2026-07-10', '15:30');
    expect(iso).not.toBeNull();
    expect(new Date(iso!).toISOString()).toBeTruthy();
  });

  it('returns null for empty date or time', () => {
    expect(combineDateTime('', '15:30')).toBeNull();
    expect(combineDateTime('2026-07-10', '')).toBeNull();
    expect(combineDateTime('   ', '15:30')).toBeNull();
    expect(combineDateTime('2026-07-10', '   ')).toBeNull();
  });

  it('returns null for invalid date/time combinations', () => {
    expect(combineDateTime('not-a-date', '15:30')).toBeNull();
    expect(combineDateTime('2026-07-10', '99:99')).toBeNull();
  });
});

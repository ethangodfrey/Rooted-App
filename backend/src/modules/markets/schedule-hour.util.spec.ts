import {
  clampHour,
  hasSuspiciousLocalStartHour,
  normalizeDays,
  sanitizeMarketHours,
} from './schedule-hour.util';

describe('clampHour', () => {
  it('returns finite numbers within range', () => {
    expect(clampHour(8, 9)).toBe(8);
    expect(clampHour(25, 9)).toBe(23);
    expect(clampHour(-3, 9)).toBe(0);
  });

  it('falls back for non-numeric values', () => {
    expect(clampHour(undefined, 8)).toBe(8);
    expect(clampHour('not-a-number', 10)).toBe(10);
    expect(clampHour(NaN, 7)).toBe(7);
  });
});

describe('sanitizeMarketHours', () => {
  it('clamps farmers market hours to sensible daytime windows', () => {
    expect(sanitizeMarketHours(2, 4, 'farmers_market')).toEqual({ startHour: 8, endHour: 13 });
    expect(sanitizeMarketHours(8, 13, 'farmers_market')).toEqual({ startHour: 8, endHour: 13 });
  });

  it('extends end hour when it is not after start hour', () => {
    expect(sanitizeMarketHours(10, 10, 'farmers_market')).toEqual({ startHour: 10, endHour: 15 });
  });

  it('allows wider hours for non-farmers market types', () => {
    expect(sanitizeMarketHours(18, 22, 'night_market')).toEqual({ startHour: 18, endHour: 22 });
  });
});

describe('normalizeDays', () => {
  it('defaults to saturday when input is empty or invalid', () => {
    expect(normalizeDays(undefined)).toEqual(['saturday']);
    expect(normalizeDays([])).toEqual(['saturday']);
    expect(normalizeDays(['notaday'])).toEqual(['saturday']);
  });

  it('deduplicates and lowercases valid days', () => {
    expect(normalizeDays(['Saturday', 'saturday', 'Sunday'])).toEqual(['saturday', 'sunday']);
  });
});

describe('hasSuspiciousLocalStartHour', () => {
  it('flags very early or very late local start hours', () => {
    // 4am Chicago (CDT) ≈ 09:00 UTC in June
    expect(hasSuspiciousLocalStartHour('2026-06-13T09:00:00.000Z', 'America/Chicago')).toBe(true);
    // 8am Chicago ≈ 13:00 UTC in June
    expect(hasSuspiciousLocalStartHour('2026-06-13T13:00:00.000Z', 'America/Chicago')).toBe(false);
  });

  it('flags large drift from expected start hour', () => {
    expect(
      hasSuspiciousLocalStartHour('2026-06-13T20:00:00.000Z', 'America/Chicago', 8),
    ).toBe(true);
  });
});

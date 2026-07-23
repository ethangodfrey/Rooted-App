import { centsToDollars, formatUsd, parseCents } from '../../tenant-web/src/lib/analytics/money';

describe('parseCents', () => {
  it('truncates finite numeric values to integers', () => {
    expect(parseCents(1250)).toBe(1250);
    expect(parseCents(99.9)).toBe(99);
    expect(parseCents(-50)).toBe(-50);
  });

  it('parses numeric strings from PostgREST payloads', () => {
    expect(parseCents('1800')).toBe(1800);
    expect(parseCents('  42  ')).toBe(42);
    expect(parseCents('12.7')).toBe(12);
  });

  it('returns zero for empty, invalid, or non-finite inputs', () => {
    expect(parseCents(undefined)).toBe(0);
    expect(parseCents(null)).toBe(0);
    expect(parseCents('')).toBe(0);
    expect(parseCents('   ')).toBe(0);
    expect(parseCents('not-a-number')).toBe(0);
    expect(parseCents(Number.NaN)).toBe(0);
    expect(parseCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('centsToDollars', () => {
  it('converts integer cents to dollar amounts', () => {
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars(150)).toBe(1.5);
    expect(centsToDollars('2450')).toBe(24.5);
  });

  it('returns zero dollars for invalid cent inputs', () => {
    expect(centsToDollars(undefined)).toBe(0);
    expect(centsToDollars('bad')).toBe(0);
  });
});

describe('formatUsd', () => {
  it('formats dollar amounts as USD currency strings', () => {
    expect(formatUsd(12.5)).toBe('$12.50');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
  });

  it('supports custom fraction digit precision', () => {
    expect(formatUsd(10, 0)).toBe('$10');
    expect(formatUsd(10.556, 1)).toBe('$10.6');
  });
});

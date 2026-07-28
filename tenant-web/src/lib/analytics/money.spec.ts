import { describe, expect, it } from 'vitest';

import { centsToDollars, formatUsd, parseCents } from './money';

describe('parseCents', () => {
  it('truncates finite numeric cents to integers', () => {
    expect(parseCents(1250)).toBe(1250);
    expect(parseCents(99.9)).toBe(99);
    expect(parseCents(-50)).toBe(-50);
  });

  it('parses trimmed numeric strings from PostgREST payloads', () => {
    expect(parseCents('1800')).toBe(1800);
    expect(parseCents('  2450  ')).toBe(2450);
    expect(parseCents('12.75')).toBe(12);
  });

  it('returns zero for empty, undefined, or invalid inputs', () => {
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
    expect(centsToDollars(1250)).toBe(12.5);
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars('999')).toBe(9.99);
  });

  it('returns zero dollars for invalid inputs', () => {
    expect(centsToDollars(undefined)).toBe(0);
    expect(centsToDollars('')).toBe(0);
  });
});

describe('formatUsd', () => {
  it('formats dollar amounts with USD currency style', () => {
    expect(formatUsd(12.5)).toBe('$12.50');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(12345.67)).toBe('$12,345.67');
  });

  it('supports custom fraction digit precision', () => {
    expect(formatUsd(12.5, 0)).toBe('$13');
    expect(formatUsd(12.34, 1)).toBe('$12.3');
  });
});

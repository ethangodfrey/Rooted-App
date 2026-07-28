import { describe, expect, it, vi } from 'vitest';

import {
  formatCurrentClock,
  formatEventDate,
  formatEventFullDate,
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

  it('coerces string-like numeric inputs through division', () => {
    expect(formatPrice('1250' as unknown as number)).toBe('$12.50');
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

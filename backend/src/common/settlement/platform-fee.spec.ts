import { computePlatformFeeCents, DEFAULT_PLATFORM_FEE_BPS, resolvePlatformFeeBps } from './platform-fee';

describe('resolvePlatformFeeBps', () => {
  it('returns the default when env is missing or blank', () => {
    expect(resolvePlatformFeeBps(undefined)).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('   ')).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it('parses valid basis-point values', () => {
    expect(resolvePlatformFeeBps('250')).toBe(250);
    expect(resolvePlatformFeeBps('0')).toBe(0);
    expect(resolvePlatformFeeBps('10000')).toBe(10_000);
  });

  it('falls back for non-numeric, negative, or out-of-range values', () => {
    expect(resolvePlatformFeeBps('not-a-number')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('-1')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('10001')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('NaN')).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });
});

describe('computePlatformFeeCents', () => {
  it('returns zero for invalid fee basis points', () => {
    expect(computePlatformFeeCents(1000, Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(1000, -100)).toBe(0);
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
  });

  it('returns zero for non-finite subtotals', () => {
    expect(computePlatformFeeCents(Number.NaN, 500)).toBe(0);
    expect(computePlatformFeeCents(Number.POSITIVE_INFINITY, 500)).toBe(0);
  });
});

import {
  DEFAULT_PLATFORM_FEE_BPS,
  computePlatformFeeCents,
  resolvePlatformFeeBps,
} from './platform-fee';

describe('resolvePlatformFeeBps', () => {
  it('returns the default when env value is missing or invalid', () => {
    expect(resolvePlatformFeeBps(undefined)).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('   ')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('not-a-number')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('-1')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('10001')).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it('parses valid basis-point values from env strings', () => {
    expect(resolvePlatformFeeBps('0')).toBe(0);
    expect(resolvePlatformFeeBps('250')).toBe(250);
    expect(resolvePlatformFeeBps(' 500 ')).toBe(500);
    expect(resolvePlatformFeeBps('10000')).toBe(10_000);
  });
});

describe('computePlatformFeeCents edge cases', () => {
  it('returns zero for invalid fee basis points', () => {
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
    expect(computePlatformFeeCents(1000, -100)).toBe(0);
    expect(computePlatformFeeCents(1000, NaN)).toBe(0);
  });

  it('returns zero for non-finite subtotals', () => {
    expect(computePlatformFeeCents(NaN, 500)).toBe(0);
    expect(computePlatformFeeCents(Infinity, 500)).toBe(0);
  });
});

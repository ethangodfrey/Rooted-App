import { computePlatformFeeCents, DEFAULT_PLATFORM_FEE_BPS, resolvePlatformFeeBps } from './platform-fee';

describe('resolvePlatformFeeBps', () => {
  it('returns the default rate when env is missing or invalid', () => {
    expect(resolvePlatformFeeBps(undefined)).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('not-a-number')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('-1')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('10001')).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it('parses valid basis points from env strings', () => {
    expect(resolvePlatformFeeBps('500')).toBe(500);
    expect(resolvePlatformFeeBps(' 250 ')).toBe(250);
    expect(resolvePlatformFeeBps('0')).toBe(0);
    expect(resolvePlatformFeeBps('10000')).toBe(10_000);
  });
});

describe('computePlatformFeeCents', () => {
  it('applies half-up rounding for fractional cents', () => {
    expect(computePlatformFeeCents(10_000, 500)).toBe(500);
    expect(computePlatformFeeCents(10_01, 500)).toBe(50);
    expect(computePlatformFeeCents(999, 500)).toBe(50);
  });

  it('returns zero for non-positive amounts or fee rates', () => {
    expect(computePlatformFeeCents(0, 500)).toBe(0);
    expect(computePlatformFeeCents(-100, 500)).toBe(0);
    expect(computePlatformFeeCents(Number.NaN, 500)).toBe(0);
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
    expect(computePlatformFeeCents(1000, -50)).toBe(0);
  });
});

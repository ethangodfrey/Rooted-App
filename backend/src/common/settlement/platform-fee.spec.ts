import {
  computePlatformFeeCents,
  DEFAULT_PLATFORM_FEE_BPS,
  resolvePlatformFeeBps,
} from './platform-fee';

describe('resolvePlatformFeeBps', () => {
  it('returns the default when env is missing or invalid', () => {
    expect(resolvePlatformFeeBps(undefined)).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('not-a-number')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('-1')).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(resolvePlatformFeeBps('10001')).toBe(DEFAULT_PLATFORM_FEE_BPS);
  });

  it('parses valid basis points from env', () => {
    expect(resolvePlatformFeeBps('0')).toBe(0);
    expect(resolvePlatformFeeBps('250')).toBe(250);
    expect(resolvePlatformFeeBps(' 500 ')).toBe(500);
  });
});

describe('computePlatformFeeCents', () => {
  it('computes half-up fee in integer cents', () => {
    expect(computePlatformFeeCents(1000, 500)).toBe(50);
    expect(computePlatformFeeCents(999, 500)).toBe(50);
    expect(computePlatformFeeCents(1, 500)).toBe(0);
  });

  it('returns zero for non-positive subtotals or fee bps', () => {
    expect(computePlatformFeeCents(0)).toBe(0);
    expect(computePlatformFeeCents(-100)).toBe(0);
    expect(computePlatformFeeCents(1000, 0)).toBe(0);
    expect(computePlatformFeeCents(Number.NaN)).toBe(0);
    expect(computePlatformFeeCents(1000, Number.NaN)).toBe(0);
  });

  it('uses the default platform fee when bps is omitted', () => {
    expect(computePlatformFeeCents(2000)).toBe(100);
  });
});
